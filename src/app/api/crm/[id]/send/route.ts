import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation, crmMessage } from "@/lib/db/schema/crm";
import { eq } from "drizzle-orm";
import { getUazapiClientForConversation } from "@/lib/uazapi";
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

    // Buscar client + dados da conversation via helper
    const result = await getUazapiClientForConversation(id);
    if (!result) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

    const { client, conversation } = result;

    // Enviar via UazapiClient
    const { messageId } = await client.sendText(
      conversation.contactPhone,
      parsed.data.message
    );

    // Persistir mensagem enviada
    const [msg] = await db
      .insert(crmMessage)
      .values({
        conversationId: id,
        messageIdWa: messageId ?? null,
        direction: "outgoing",
        content: parsed.data.message,
        mediaType: "text",
        status: "sent",
      })
      .returning();

    // Atualizar timestamp da conversa
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
