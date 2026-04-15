import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { crmConversation, whatsappNumber } from "@/lib/db/schema/crm";
import { eq, and, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canView = await checkPermission(ctx.userId, ctx.role as UserRole, "crm", "view", ctx);
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const classification = searchParams.get("classification");
    const numberId = searchParams.get("numberId");

    // Filtrar por tenant
    const whereConditions = [eq(crmConversation.tenantId, ctx.tenantId)];
    if (numberId) whereConditions.push(eq(crmConversation.whatsappNumberId, numberId));
    if (classification) whereConditions.push(eq(crmConversation.classification, classification));

    const conversations = await db
      .select({
        id: crmConversation.id,
        whatsappNumberId: crmConversation.whatsappNumberId,
        contactPhone: crmConversation.contactPhone,
        contactName: crmConversation.contactName,
        contactPushName: crmConversation.contactPushName,
        classification: crmConversation.classification,
        lastMessageAt: crmConversation.lastMessageAt,
        unreadCount: crmConversation.unreadCount,
        updatedAt: crmConversation.updatedAt,
        numberLabel: whatsappNumber.label,
        numberPhone: whatsappNumber.phoneNumber,
      })
      .from(crmConversation)
      .leftJoin(whatsappNumber, eq(crmConversation.whatsappNumberId, whatsappNumber.id))
      .where(and(...whereConditions))
      .orderBy(desc(crmConversation.lastMessageAt));

    const numbers = await db
      .select()
      .from(whatsappNumber)
      .where(and(eq(whatsappNumber.isActive, true), eq(whatsappNumber.tenantId, ctx.tenantId)));

    return NextResponse.json({ conversations, numbers });
  } catch {
    console.error("[CRM] GET failed:", { operation: "list" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
