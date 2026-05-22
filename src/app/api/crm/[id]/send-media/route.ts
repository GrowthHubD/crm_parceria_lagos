import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { crmConversation, crmMessage, whatsappNumber } from "@/lib/db/schema/crm";
import { eq, and } from "drizzle-orm";
import { sendMedia } from "@/lib/whatsapp";
import { uploadWhatsappMedia } from "@/lib/supabase-storage";
import type { UserRole } from "@/types";

const schema = z.object({
  file: z.string().regex(/^data:/),
  fileName: z.string().optional(),
  isImage: z.boolean().optional(),
  /** Sinaliza áudio gravado pelo CRM (vira mensagem de voz / PTT no WhatsApp). */
  isAudio: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantContext(request.headers);
    const canEdit = await checkPermission(ctx.userId, ctx.role as UserRole, "crm", "edit", ctx);
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const [conv] = await db
      .select({
        id: crmConversation.id,
        contactPhone: crmConversation.contactPhone,
        contactJid: crmConversation.contactJid,
        whatsappNumberId: crmConversation.whatsappNumberId,
      })
      .from(crmConversation)
      .where(and(eq(crmConversation.id, id), eq(crmConversation.tenantId, ctx.tenantId)))
      .limit(1);

    if (!conv) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

    const [wNum] = await db
      .select({
        uazapiSession: whatsappNumber.uazapiSession,
        uazapiToken: whatsappNumber.uazapiToken,
      })
      .from(whatsappNumber)
      .where(eq(whatsappNumber.id, conv.whatsappNumberId))
      .limit(1);

    if (!wNum?.uazapiSession || wNum.uazapiSession === "baileys") {
      return NextResponse.json({ error: "WhatsApp não conectado" }, { status: 503 });
    }

    const { file, fileName, isImage: isImageFlag, isAudio: isAudioFlag } = parsed.data;
    const mimeMatch = file.match(/^data:([^;]+);/);
    const mimetype = mimeMatch?.[1] ?? "";
    // Prefer explicit flag from client (browser file.type is authoritative)
    const isAudio = isAudioFlag ?? mimetype.startsWith("audio/");
    const isImage = !isAudio && (isImageFlag ?? mimetype.startsWith("image/"));
    const isVideo = !isAudio && !isImage && mimetype.startsWith("video/");
    const mediaType = isAudio ? "audio" : isImage ? "image" : isVideo ? "video" : "document";

    // Pra áudio: WhatsApp PTT (balão de voz) exige container OGG + codec libopus.
    // Cliente (AudioRecorder) grava direto em OGG/opus via opus-recorder — não
    // precisamos converter aqui. Se vier outro formato (webm), rejeitamos pra
    // não etiquetar mentirosamente como audio/ogg no Storage.
    if (isAudio) {
      const isOgg = mimetype.includes("ogg") || mimetype.includes("opus");
      if (!isOgg) {
        return NextResponse.json(
          { error: `Áudio precisa estar em audio/ogg (codecs=opus). Recebido: ${mimetype}` },
          { status: 400 }
        );
      }
    }

    // Sobe a mídia pro Storage. Pra áudio, normaliza o mime pra "audio/ogg"
    // (sem o parâmetro `codecs=opus`) pra bater com a allowlist do bucket.
    const storageMime = isAudio ? "audio/ogg" : mimetype;
    const uploaded = await uploadWhatsappMedia({
      tenantId: ctx.tenantId,
      conversationId: id,
      data: file,
      mimetype: storageMime,
      filename: fileName,
    });
    const mediaUrlStored = uploaded?.publicUrl ?? file;

    // Envia pro WhatsApp via facade. Usa URL pública do Storage (Uazapi
    // detecta PTT melhor com URL HTTPS do que com data URI grande).
    const target = conv.contactJid ?? conv.contactPhone;
    const fileForSend = uploaded?.publicUrl ?? file;
    const fileNameForSend = isAudio ? (fileName ?? "audio.ogg") : fileName;
    const result = await sendMedia(
      wNum.uazapiSession,
      wNum.uazapiToken || undefined,
      target,
      fileForSend,
      fileNameForSend
    );

    // Mesmo fix do send/route.ts: nunca marcar como "sent" se o provider
    // retornou erro. Logar + 502 + status="failed" no DB.
    if (result.error || !result.messageId) {
      console.error("[CRM] sendMedia falhou:", {
        operation: "send-media",
        conversationId: id,
        provider_error: result.error ?? "no messageId returned",
        instance: wNum.uazapiSession,
        mediaType,
      });
      await db.insert(crmMessage).values({
        conversationId: id,
        messageIdWa: null,
        direction: "outgoing",
        mediaType,
        mediaUrl: mediaUrlStored,
        content: isAudio || isImage || isVideo ? null : (fileName ?? null),
        status: "failed",
      });
      return NextResponse.json(
        { error: result.error ?? "Falha ao entregar mídia ao WhatsApp" },
        { status: 502 }
      );
    }

    const [msg] = await db
      .insert(crmMessage)
      .values({
        conversationId: id,
        messageIdWa: result.messageId,
        direction: "outgoing",
        mediaType,
        mediaUrl: mediaUrlStored,
        // Áudio e imagem não têm "content" textual; documento usa fileName.
        content: isAudio || isImage || isVideo ? null : (fileName ?? null),
        status: "sent",
      })
      .returning();

    await db
      .update(crmConversation)
      .set({ lastMessageAt: new Date(), lastOutgoingAt: new Date(), updatedAt: new Date() })
      .where(eq(crmConversation.id, id));

    return NextResponse.json({ message: msg });
  } catch (e) {
    return handleApiError(e, "CRM POST send-media");
  }
}
