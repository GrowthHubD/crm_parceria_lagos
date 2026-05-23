/**
 * Lead matching por telefone — usado quando uma mensagem WhatsApp chega
 * via webhook e o sistema precisa decidir entre:
 *   - vincular a um lead já existente no tenant (mesmo phone normalizado), OU
 *   - criar lead novo (comportamento legado).
 *
 * Módulo isolado pra não acoplar a webhook handlers / automation runner.
 * Não toca `triggerFirstMessage` — quem invoca decide se dispara automação
 * ou não (no caso atual: NÃO dispara em re-engajamento).
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { lead } from "../db/schema/pipeline";

export interface ExistingLead {
  id: string;
  crmConversationId: string | null;
}

/**
 * Procura o lead mais recente do tenant com o phone exato. Retorna null se
 * não houver. ORDER BY created_at DESC pra cobrir o caso (raro) de existirem
 * duplicatas legadas — pegamos o mais novo, que tende a ser o "atual".
 *
 * Performance: usa o índice `idx_lead_tenant_phone` (parcial em WHERE phone
 * IS NOT NULL). Custo O(log n) — seguro pra rodar em todo webhook incoming.
 */
export async function findExistingLeadByPhone(
  tenantId: string,
  phone: string
): Promise<ExistingLead | null> {
  if (!phone) return null;
  const [row] = await db
    .select({
      id: lead.id,
      crmConversationId: lead.crmConversationId,
    })
    .from(lead)
    .where(and(eq(lead.tenantId, tenantId), eq(lead.phone, phone)))
    .orderBy(desc(lead.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Atualiza o `crmConversationId` do lead pra apontar pra uma nova conversa.
 * Sobrescreve se já houver outra — comportamento intencional: a conversa
 * "ativa" é sempre a mais recente. A conversa antiga continua existindo na
 * tabela `crm_conversation` mas não é mais o "current" do lead.
 */
export async function linkConversationToLead(
  leadId: string,
  conversationId: string
): Promise<void> {
  await db
    .update(lead)
    .set({ crmConversationId: conversationId, updatedAt: new Date() })
    .where(eq(lead.id, leadId));
}
