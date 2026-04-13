import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation, crmMessage, whatsappNumber } from "@/lib/db/schema/crm";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const sendSchema = z.object({
  message: z.string().min(1).max(4096),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "crm", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const [conversation] = await db
      .select({
        id: crmConversation.id,
        contactPhone: crmConversation.contactPhone,
        whatsappNumberId: crmConversation.whatsappNumberId,
        uazapiSession: whatsappNumber.uazapiSession,
        uazapiToken: whatsappNumber.uazapiToken,
      })
      .from(crmConversation)
      .innerJoin(whatsappNumber, eq(crmConversation.whatsappNumberId, whatsappNumber.id))
      .where(eq(crmConversation.id, id))
      .limit(1);

    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

    const baseUrl = process.env.UAZAPI_BASE_URL;
    if (!baseUrl) return NextResponse.json({ error: "UAZAPI_BASE_URL não configurado" }, { status: 503 });

    // Send via Uazapi
    const uazapiRes = await fetch(`${baseUrl}/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "SessionKey": conversation.uazapiSession,
        "Token": conversation.uazapiToken,
      },
      body: JSON.stringify({
        phone: conversation.contactPhone,
        message: parsed.data.message,
      }),
    });

    if (!uazapiRes.ok) {
      console.error("[CRM] Uazapi send failed:", { operation: "send", status: uazapiRes.status });
      return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 502 });
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}));

    // Persist outgoing message
    const [msg] = await db
      .insert(crmMessage)
      .values({
        conversationId: id,
        messageIdWa: uazapiData?.key?.id ?? null,
        direction: "outgoing",
        content: parsed.data.message,
        mediaType: "text",
        status: "sent",
      })
      .returning();

    // Update conversation's last message timestamp
    await db
      .update(crmConversation)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(crmConversation.id, id));

    return NextResponse.json({ message: msg });
  } catch {
    console.error("[CRM] POST send failed:", { operation: "send" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
