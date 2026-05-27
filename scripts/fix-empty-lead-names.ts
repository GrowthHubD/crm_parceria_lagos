/**
 * scripts/fix-empty-lead-names.ts
 *
 * Preenche `lead.name` em leads existentes que ficaram com nome vazio
 * (webhook v2 antigo usava `pushName ?? contactPhone` com ??, que preserva
 * string vazia). Cards do pipeline desses leads ficavam fantasmas — só
 * "Atualizado: dd/mm/yyyy" + avatar "?".
 *
 * Estratégia: name = COALESCE(NULLIF(phone, ''), 'Contato sem nome').
 * Idempotente — re-rodar não muda nada.
 *
 * Uso:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/fix-empty-lead-names.ts             # dry-run (count + amostras)
 *   npx tsx scripts/fix-empty-lead-names.ts --apply     # de fato roda UPDATE
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const apply = process.argv.includes("--apply");

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL no ambiente");

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    const [{ total }] = await sql<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM lead
      WHERE name IS NULL OR name = ''
    `;
    console.log(`→ Leads com name vazio/null: ${total}`);

    if (Number(total) === 0) {
      console.log("✓ Nada a corrigir.");
      return;
    }

    if (!apply) {
      console.log("\nAmostras (10):");
      const samples = await sql<Array<{
        id: string;
        tenantId: string;
        phone: string | null;
        currentName: string | null;
        newName: string;
      }>>`
        SELECT
          id,
          tenant_id AS "tenantId",
          phone,
          name AS "currentName",
          COALESCE(NULLIF(phone, ''), 'Contato sem nome') AS "newName"
        FROM lead
        WHERE name IS NULL OR name = ''
        LIMIT 10
      `;
      for (const s of samples) {
        console.log(`  ${s.id.slice(0, 8)}…  phone="${s.phone ?? "null"}"  name="${s.currentName ?? "null"}" → "${s.newName}"`);
      }
      console.log("\n→ Dry-run. Re-rode com --apply pra aplicar.");
      return;
    }

    console.log("\n→ Aplicando UPDATE ...");
    const result = await sql<Array<{ id: string }>>`
      UPDATE lead
      SET name = COALESCE(NULLIF(phone, ''), 'Contato sem nome'),
          updated_at = NOW()
      WHERE name IS NULL OR name = ''
      RETURNING id
    `;
    console.log(`✓ ${result.length} lead(s) corrigido(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
