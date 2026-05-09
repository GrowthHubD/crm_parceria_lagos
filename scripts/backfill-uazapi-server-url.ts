/**
 * Backfill `whatsapp_number.server_url` em rows existentes pra growthhub.
 *
 * Regra: rows com uazapi_session != 'baileys%' e server_url IS NULL
 *        recebem server_url = 'https://growthhub.uazapi.com'.
 *
 * Uso: npx tsx scripts/backfill-uazapi-server-url.ts
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });
import postgres from "postgres";

const TARGET_SERVER = "https://growthhub.uazapi.com";

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { prepare: false, max: 1 });

  // Preview
  const candidates = await sql<{ id: string; tenant_id: string; phone_number: string; uazapi_session: string }[]>`
    SELECT id, tenant_id, phone_number, uazapi_session
    FROM public.whatsapp_number
    WHERE server_url IS NULL
      AND uazapi_session NOT LIKE 'baileys%'
  `;

  console.log(`Candidatos: ${candidates.length}`);
  candidates.forEach((c) =>
    console.log(`  • ${c.phone_number} session=${c.uazapi_session}`)
  );

  if (candidates.length === 0) {
    console.log("Nada a fazer.");
    await sql.end();
    return;
  }

  const updated = await sql<{ id: string }[]>`
    UPDATE public.whatsapp_number
    SET server_url = ${TARGET_SERVER}
    WHERE server_url IS NULL
      AND uazapi_session NOT LIKE 'baileys%'
    RETURNING id
  `;
  console.log(`✓ Atualizadas ${updated.length} rows com server_url=${TARGET_SERVER}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
