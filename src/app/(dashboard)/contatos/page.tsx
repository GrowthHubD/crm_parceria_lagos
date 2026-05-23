/**
 * /contatos — Lista geral de contatos do tenant.
 *
 * Diferente de /crm (inbox de conversas) e /clientes (cadastro manual de
 * empresas): aqui é a visão unificada de TODA PESSOA que está no pipeline
 * do tenant — com ou sem conversa WhatsApp atrelada.
 *
 * SSR pequeno: 100 contatos mais recentes. Refinos (busca, filtro, mais
 * páginas) via /api/contatos no client.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { checkPermission } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { crmConversation } from "@/lib/db/schema/crm";
import { eq, and, desc } from "drizzle-orm";
import { ContatosList } from "@/components/contatos/contatos-list";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "Contatos" };

export default async function ContatosPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;

  const canView = await checkPermission(session.user.id, userRole, "contatos", "view");
  if (!canView) redirect("/");

  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  // Query unificada: lead LEFT JOIN crm_conversation (por crmConversationId)
  // + LEFT JOIN pipeline_stage (pra mostrar stage atual).
  // Limitado a 100 mais recentes (paginação via API depois).
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
    .where(eq(lead.tenantId, tenantCtx.tenantId))
    .orderBy(desc(lead.updatedAt))
    .limit(100);

  const initialContacts = rows.map((r) => ({
    ...r,
    estimatedValue: r.estimatedValue ? String(r.estimatedValue) : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
  }));

  return <ContatosList initialContacts={initialContacts} />;
}
