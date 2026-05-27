/**
 * scripts/normalize-existing-phones.ts
 *
 * Normaliza lead.phone EXISTENTES pra forma canônica (só dígitos).
 * Idempotente — re-rodar não muda nada.
 *
 * Rodar ANTES de apply-lead-phone-index.ts (UNIQUE) pra evitar duplicatas
 * que existem só por diferença de formato ("(11) 99999-9999" vs "11999999999").
 *
 * Uso:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/normalize-existing-phones.ts            # dry-run (count)
 *   npx tsx scripts/normalize-existing-phones.ts --apply    # de fato roda UPDATE
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
      WHERE phone IS NOT NULL AND phone ~ '\\D'
    `;
    console.log(`→ Leads com phone em formato não-canônico: ${total}`);

    if (Number(total) === 0) {
      console.log("✓ Nada a normalizar.");
      return;
    }

    if (!apply) {
      console.log("\nPreview de amostras (10):");
      const samples = await sql<Array<{ id: string; phone: string; normalized: string }>>`
        SELECT id, phone, regexp_replace(phone, '\\D', '', 'g') AS normalized
        FROM lead
        WHERE phone IS NOT NULL AND phone ~ '\\D'
        LIMIT 10
      `;
      for (const s of samples) {
        console.log(`  ${s.id.slice(0, 8)}…  "${s.phone}" → "${s.normalized}"`);
      }
      console.log("\n→ Dry-run. Re-rode com --apply pra aplicar.");
      return;
    }

    console.log("\n→ Aplicando UPDATE ...");
    const result = await sql<Array<{ id: string }>>`
      UPDATE lead
      SET phone = regexp_replace(phone, '\\D', '', 'g'),
          updated_at = NOW()
      WHERE phone IS NOT NULL AND phone ~ '\\D'
      RETURNING id
    `;
    console.log(`✓ ${result.length} lead(s) normalizado(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
