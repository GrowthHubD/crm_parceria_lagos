/**
 * GET /api/contatos
 * Lista geral de contatos do tenant (lead + crm_conversation unified).
 * Suporta busca por nome/phone/email e paginação por offset.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant";
import { handleApiError } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { crmConversation } from "@/lib/db/schema/crm";
import { eq, and, desc, or, ilike, sql } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canView = await checkPermission(ctx.userId, ctx.role as UserRole, "contatos", "view", ctx);
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    const whereConditions = [eq(lead.tenantId, ctx.tenantId)];
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(lead.name, like),
        ilike(lead.phone, like),
        ilike(lead.email, like),
        ilike(lead.companyName, like)
      );
      if (search) whereConditions.push(search);
    }

    const rows = await db
      .select({
        id: lead.id,
        name: lead.name,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        estimatedValue: lead.estimatedValue,
        isConverted: lead.isConverted,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        stageId: lead.stageId,
        stageName: pipelineStage.name,
        stageColor: pipelineStage.color,
        crmConversationId: lead.crmConversationId,
        lastMessageAt: crmConversation.lastMessageAt,
        contactPushName: crmConversation.contactPushName,
        contactProfilePicUrl: crmConversation.contactProfilePicUrl,
        unreadCount: crmConversation.unreadCount,
        classification: crmConversation.classification,
      })
      .from(lead)
      .leftJoin(pipelineStage, eq(pipelineStage.id, lead.stageId))
      .leftJoin(crmConversation, eq(crmConversation.id, lead.crmConversationId))
      .where(and(...whereConditions))
      .orderBy(desc(lead.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(lead)
      .where(and(...whereConditions));

    const contacts = rows.map((r) => ({
      ...r,
      estimatedValue: r.estimatedValue ? String(r.estimatedValue) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    }));

    return NextResponse.json({ contacts, total, limit, offset });
  } catch (e) {
    return handleApiError(e, "CONTATOS GET");
  }
}
