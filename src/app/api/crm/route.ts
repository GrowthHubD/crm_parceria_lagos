import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation, whatsappNumber } from "@/lib/db/schema/crm";
import { eq, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "crm", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const classification = searchParams.get("classification");
    const numberId = searchParams.get("numberId");

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
      .where(
        numberId
          ? eq(crmConversation.whatsappNumberId, numberId)
          : classification
            ? eq(crmConversation.classification, classification)
            : undefined
      )
      .orderBy(desc(crmConversation.lastMessageAt));

    const numbers = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.isActive, true));

    return NextResponse.json({ conversations, numbers });
  } catch {
    console.error("[CRM] GET failed:", { operation: "list" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
