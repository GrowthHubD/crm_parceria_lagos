/**
 * scripts/apply-lead-phone-index.ts
 *
 * Aplica o UNIQUE index parcial (tenant_id, phone) em lead pra fechar a
 * race entre findExistingLeadByPhone e INSERT. Faz ON CONFLICT funcionar.
 *
 * Fluxo:
 *   1. Conta duplicatas legadas (lead com mesmo (tenant_id, phone)).
 *   2. Se 0 → drop velho idx + CREATE UNIQUE INDEX CONCURRENTLY.
 *   3. Se >0 → lista e sai SEM mexer. User decide: dedup manual ou rodar
 *      com --dedup flag (mantém mais antigo por created_at, deleta resto).
 *
 * CONCURRENTLY = não bloqueia writes. Idempotente.
 *
 * Uso:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/apply-lead-phone-index.ts             # check + apply se 0 dup
 *   npx tsx scripts/apply-lead-phone-index.ts --dedup     # também deleta duplicatas
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const args = new Set(process.argv.slice(2));
  const allowDedup = args.has("--dedup");

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL no ambiente");

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    // Step 0 — sempre garante o índice de updated_at (não-unique, sem risco)
    console.log("→ idx_lead_tenant_updated (idempotente) ...");
    await sql.unsafe(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_tenant_updated
      ON lead (tenant_id, updated_at DESC)
    `);
    console.log("  ✓ ok");

    // Step 1 — check de duplicatas legadas
    console.log("\n→ Verificando duplicatas (tenant_id, phone) ...");
    const dups = await sql<Array<{ tenantId: string; phone: string; count: bigint }>>`
      SELECT tenant_id AS "tenantId", phone, COUNT(*)::bigint AS count
      FROM lead
      WHERE phone IS NOT NULL AND phone <> ''
      GROUP BY tenant_id, phone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 30
    `;

    if (dups.length > 0) {
      console.log(`\n⚠ Encontradas ${dups.length} chave(s) duplicada(s):`);
      for (const d of dups) {
        console.log(`  tenant=${d.tenantId.slice(0, 8)}… phone=${d.phone} → ${d.count} rows`);
      }

      if (!allowDedup) {
        console.log("\n✗ ABORTANDO: criar UNIQUE com duplicatas presentes falharia.");
        console.log("  Re-rode com --dedup pra deletar duplicatas (mantém a mais ANTIGA");
        console.log("  por created_at — preserva histórico original).");
        return;
      }

      console.log("\n→ Dedup ativo: deletando duplicatas mais recentes ...");
      const deleted = await sql<Array<{ id: string }>>`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY tenant_id, phone ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM lead
          WHERE phone IS NOT NULL AND phone <> ''
        )
        DELETE FROM lead
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
        RETURNING id
      `;
      console.log(`  ✓ ${deleted.length} lead(s) duplicado(s) removido(s)`);
    } else {
      console.log("  ✓ Sem duplicatas. Seguro pra criar UNIQUE.");
    }

    // Step 2 — drop o non-unique velho (se existir) + create UNIQUE
    console.log("\n→ Removendo idx_lead_tenant_phone antigo (não-unique, se existe) ...");
    await sql.unsafe(`DROP INDEX IF EXISTS idx_lead_tenant_phone`);
    console.log("  ✓ ok");

    console.log("\n→ Criando uq_lead_tenant_phone (UNIQUE partial) ...");
    await sql.unsafe(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_lead_tenant_phone
      ON lead (tenant_id, phone)
      WHERE phone IS NOT NULL AND phone <> ''
    `);
    console.log("  ✓ ok");

    console.log("\n✓ Tudo aplicado. ON CONFLICT (tenant_id, phone) DO NOTHING agora funciona.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
