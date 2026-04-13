import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation, crmMessage } from "@/lib/db/schema/crm";
import { eq, asc, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateConversationSchema = z.object({
  classification: z.enum(["hot", "warm", "cold", "active_client", "new"]).optional(),
  contactName: z.string().optional().nullable(),
  unreadCount: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "crm", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [conversation] = await db
      .select()
      .from(crmConversation)
      .where(eq(crmConversation.id, id))
      .limit(1);

    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

    const messages = await db
      .select()
      .from(crmMessage)
      .where(eq(crmMessage.conversationId, id))
      .orderBy(asc(crmMessage.timestamp));

    // Mark as read
    if (conversation.unreadCount > 0) {
      await db
        .update(crmConversation)
        .set({ unreadCount: 0 })
        .where(eq(crmConversation.id, id));
    }

    return NextResponse.json({ conversation: { ...conversation, unreadCount: 0 }, messages });
  } catch {
    console.error("[CRM] GET conversation failed:", { operation: "get" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(
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
    const parsed = updateConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const d = parsed.data;
    if (d.classification !== undefined) updates.classification = d.classification;
    if (d.contactName !== undefined) updates.contactName = d.contactName;
    if (d.unreadCount !== undefined) updates.unreadCount = d.unreadCount;

    const [updated] = await db
      .update(crmConversation)
      .set(updates)
      .where(eq(crmConversation.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    return NextResponse.json({ conversation: updated });
  } catch {
    console.error("[CRM] PATCH conversation failed:", { operation: "update" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
