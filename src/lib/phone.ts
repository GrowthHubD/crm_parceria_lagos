/**
 * Normalização canônica de número de telefone.
 *
 * Forma canônica: apenas dígitos. Sem +, espaços, parênteses, traços.
 * Idempotente. Aceita string vazia / null guard externo.
 *
 * Usado em TODOS os entry points que tocam lead.phone ou
 * crm_conversation.contact_phone:
 *   - webhook (extractPhone já normaliza, mas passa por aqui pra garantir)
 *   - POST /api/pipeline/leads (form livre — usuário pode digitar "(11) 99999-9999")
 *   - findExistingLeadByPhone lookup
 *
 * Sem normalizar, leads criados manualmente NUNCA dão match com webhooks —
 * porque o webhook envia "5511999999999" e o form salva "(11) 99999-9999".
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}
