/**
 * scripts/apply-lead-phone-index.ts
 *
 * Aplica os índices que aceleram lead matching e listagem de contatos.
 * CONCURRENTLY = não bloqueia writes — seguro pra rodar em prod online.
 * IF NOT EXISTS = idempotente, pode re-rodar.
 *
 * Uso:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/apply-lead-phone-index.ts
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL no ambiente");

  // CONCURRENTLY requer connection direta (não pode estar em transaction).
  // postgres-js cria connection per-query — OK.
  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    const statements: Array<{ name: string; sql: string }> = [
      {
        name: "idx_lead_tenant_phone",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_tenant_phone
              ON lead (tenant_id, phone) WHERE phone IS NOT NULL`,
      },
      {
        name: "idx_lead_tenant_updated",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_tenant_updated
              ON lead (tenant_id, updated_at DESC)`,
      },
    ];

    for (const stmt of statements) {
      console.log(`→ ${stmt.name} ...`);
      await sql.unsafe(stmt.sql);
      console.log(`  ✓ ok`);
    }

    console.log("\n✓ Todos os índices aplicados");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
