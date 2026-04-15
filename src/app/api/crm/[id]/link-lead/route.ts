import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation } from "@/lib/db/schema/crm";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { eq, and, asc } from "drizzle-orm";
import type { UserRole } from "@/types";

const linkSchema = z.object({
  leadId: z.string().uuid().optional(),
  createNew: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const ctx = await getTenantContext(request.headers);
    const canEdit = await checkPermission(ctx.userId, ctx.role as UserRole, "crm", "edit", ctx);
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // Validar que conversation pertence ao tenant
    const [conversation] = await db
      .select()
      .from(crmConversation)
      .where(and(eq(crmConversation.id, conversationId), eq(crmConversation.tenantId, ctx.tenantId)))
      .limit(1);

    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const { leadId, createNew } = parsed.data;

    if (leadId) {
      // Vincular a lead existente
      const [existingLead] = await db
        .select({ id: lead.id })
        .from(lead)
        .where(and(eq(lead.id, leadId), eq(lead.tenantId, ctx.tenantId)))
        .limit(1);

      if (!existingLead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

      await db
        .update(lead)
        .set({ crmConversationId: conversationId })
        .where(eq(lead.id, leadId));

      return NextResponse.json({ linked: true, leadId });
    }

    if (createNew) {
      // Criar novo lead a partir da conversation
      const [firstStage] = await db
        .select({ id: pipelineStage.id })
        .from(pipelineStage)
        .where(eq(pipelineStage.tenantId, ctx.tenantId))
        .orderBy(asc(pipelineStage.order))
        .limit(1);

      if (!firstStage) return NextResponse.json({ error: "Nenhum stage encontrado" }, { status: 400 });

      const [newLead] = await db
        .insert(lead)
        .values({
          tenantId: ctx.tenantId,
          name: conversation.contactName ?? conversation.contactPushName ?? conversation.contactPhone,
          phone: conversation.contactPhone,
          pushName: conversation.contactPushName,
          stageId: firstStage.id,
          source: "inbound",
          crmConversationId: conversationId,
        })
        .returning();

      return NextResponse.json({ linked: true, leadId: newLead.id, created: true });
    }

    return NextResponse.json({ error: "leadId ou createNew obrigatório" }, { status: 400 });
  } catch {
    console.error("[CRM] link-lead failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
