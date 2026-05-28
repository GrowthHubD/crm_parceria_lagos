/**
 * Backfill: cria 1 lead pra TODA conversa que ainda não tem lead vinculado.
 *
 * Contexto: o webhook só criava lead quando a conversa era nova E o tenant já
 * tinha funil. Conversas criadas antes do funil existir (ou em tenants sem
 * funil) ficaram permanentemente sem lead → pipeline vazio apesar de conversas
 * ativas. Este script repara o histórico. O fix no webhook (ensureDefaultPipeline)
 * garante que daqui pra frente toda conversa nova já vira lead.
 *
 * Idempotente:
 *   - pula conversas que já têm lead;
 *   - respeita o índice único uq_lead_tenant_phone (dedup por telefone):
 *     se já existe lead com o mesmo phone, NÃO duplica — linka a conversa nele.
 *
 * Uso:
 *   npx tsx scripts/backfill-leads-from-conversations.ts --dry   # só conta
 *   npx tsx scripts/backfill-leads-from-conversations.ts         # aplica
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: false });
dotenvConfig({ path: "../.env.local", override: false });
import postgres from "postgres";

const DEFAULT_STAGES = [
  { name: "Novo", order: 0, color: "#6B7280", isWon: false },
  { name: "Em contato", order: 1, color: "#3B82F6", isWon: false },
  { name: "Negociação", order: 2, color: "#F59E0B", isWon: false },
  { name: "Ganho", order: 3, color: "#10B981", isWon: true },
  { name: "Perdido", order: 4, color: "#EF4444", isWon: false },
];

type Sql = ReturnType<typeof postgres>;

/** Garante funil default + etapas do tenant; retorna o id da primeira etapa. */
async function ensureFirstStage(sql: Sql, tenantId: string): Promise<string> {
  let [pl] =
    await sql`select id from pipeline where tenant_id=${tenantId} and is_default=true limit 1`;
  if (!pl) {
    [pl] = await sql`select id from pipeline where tenant_id=${tenantId} order by created_at asc limit 1`;
  }
  if (!pl) {
    [pl] = await sql`
      insert into pipeline (tenant_id, name, description, is_default)
      values (${tenantId}, 'Funil principal', 'Funil padrão', true)
      returning id`;
  }

  let stages =
    await sql`select id, "order" from pipeline_stage where tenant_id=${tenantId} and pipeline_id=${pl.id} order by "order" asc`;
  if (stages.length === 0) {
    for (const s of DEFAULT_STAGES) {
      await sql`
        insert into pipeline_stage (tenant_id, pipeline_id, name, "order", color, is_won)
        values (${tenantId}, ${pl.id}, ${s.name}, ${s.order}, ${s.color}, ${s.isWon})`;
    }
    stages =
      await sql`select id, "order" from pipeline_stage where tenant_id=${tenantId} and pipeline_id=${pl.id} order by "order" asc`;
  }
  return stages[0].id as string;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const conn = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!conn) throw new Error("Faltou DATABASE_URL / DIRECT_URL no env");
  const sql = postgres(conn, { prepare: false, max: 1, ssl: "require", connect_timeout: 20 });

  try {
    const convs = await sql`
      select c.id, c.tenant_id, c.contact_phone, c.contact_name, c.contact_push_name
      from crm_conversation c
      where c.is_group = false
        and not exists (select 1 from lead l where l.crm_conversation_id = c.id)
      order by c.tenant_id, c.created_at asc`;

    console.log(`→ ${convs.length} conversa(s) sem lead${dry ? " (DRY RUN — nada será gravado)" : ""}`);

    const firstStageByTenant = new Map<string, string>();
    let created = 0;
    let linked = 0;
    let skipped = 0;
    const perTenant: Record<string, { created: number; linked: number; skipped: number }> = {};
    const bump = (t: string, k: "created" | "linked" | "skipped") => {
      (perTenant[t] ??= { created: 0, linked: 0, skipped: 0 })[k]++;
    };

    for (const c of convs) {
      const tenantId = c.tenant_id as string;
      const name =
        (c.contact_push_name as string | null)?.trim() ||
        (c.contact_name as string | null)?.trim() ||
        (c.contact_phone as string | null)?.trim() ||
        "Contato sem nome";
      const phone = ((c.contact_phone as string | null) ?? "").replace(/\D/g, "") || null;
      const pushName = (c.contact_push_name as string | null)?.trim() || null;

      if (dry) {
        bump(tenantId, "skipped");
        skipped++;
        continue;
      }

      if (!firstStageByTenant.has(tenantId)) {
        firstStageByTenant.set(tenantId, await ensureFirstStage(sql, tenantId));
      }
      const stageId = firstStageByTenant.get(tenantId)!;

      // Tenta criar. Conflito no índice parcial (tenant_id, phone) = já existe
      // lead com esse telefone → não duplica.
      const ins = await sql`
        insert into lead (tenant_id, name, phone, push_name, stage_id, source, crm_conversation_id)
        values (${tenantId}, ${name}, ${phone}, ${pushName}, ${stageId}, 'inbound', ${c.id})
        on conflict (tenant_id, phone) where (phone is not null and phone <> '')
        do nothing
        returning id`;

      if (ins.length > 0) {
        created++;
        bump(tenantId, "created");
        continue;
      }

      // Houve conflito: existe lead com esse phone. Linka a conversa nele se
      // ele ainda não tiver conversa vinculada.
      if (phone) {
        const upd = await sql`
          update lead set crm_conversation_id = ${c.id}, updated_at = now()
          where tenant_id = ${tenantId} and phone = ${phone} and crm_conversation_id is null
          returning id`;
        if (upd.length > 0) {
          linked++;
          bump(tenantId, "linked");
          continue;
        }
      }
      skipped++;
      bump(tenantId, "skipped");
    }

    console.log(`\n✓ Resumo: criados=${created} linkados=${linked} pulados=${skipped}`);
    for (const [t, s] of Object.entries(perTenant)) {
      console.log(`   tenant ${t}: criados=${s.created} linkados=${s.linked} pulados=${s.skipped}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
