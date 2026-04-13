import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { crmConversation, whatsappNumber } from "@/lib/db/schema/crm";
import { eq, desc } from "drizzle-orm";
import { Inbox } from "@/components/crm/inbox";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "CRM" };

export default async function CrmPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;

  const [canView, canEdit] = await Promise.all([
    checkPermission(session.user.id, userRole, "crm", "view"),
    checkPermission(session.user.id, userRole, "crm", "edit"),
  ]);

  if (!canView) redirect("/");

  const [conversations, numbers] = await Promise.all([
    db
      .select({
        id: crmConversation.id,
        whatsappNumberId: crmConversation.whatsappNumberId,
        contactPhone: crmConversation.contactPhone,
        contactName: crmConversation.contactName,
        contactPushName: crmConversation.contactPushName,
        classification: crmConversation.classification,
        lastMessageAt: crmConversation.lastMessageAt,
        unreadCount: crmConversation.unreadCount,
        numberLabel: whatsappNumber.label,
        numberPhone: whatsappNumber.phoneNumber,
      })
      .from(crmConversation)
      .leftJoin(whatsappNumber, eq(crmConversation.whatsappNumberId, whatsappNumber.id))
      .orderBy(desc(crmConversation.lastMessageAt)),
    db.select().from(whatsappNumber).where(eq(whatsappNumber.isActive, true)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-foreground">CRM</h1>
        <p className="text-muted mt-1">Inbox de mensagens WhatsApp</p>
      </div>

      {numbers.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <p className="text-muted text-sm">Nenhum número WhatsApp cadastrado.</p>
          <p className="text-small text-muted/60 mt-2">
            Configure os números na tabela <code className="font-mono bg-surface-2 px-1 rounded">whatsapp_number</code> para começar a receber mensagens.
          </p>
        </div>
      ) : (
        <Inbox
          initialConversations={conversations.map((c) => ({
            ...c,
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          }))}
          numbers={numbers}
          canEdit={canEdit}
          currentUserId={session.user.id}
        />
      )}
    </div>
  );
}
