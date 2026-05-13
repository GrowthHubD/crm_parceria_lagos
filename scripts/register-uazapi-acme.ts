/**
 * Vincula a instância Uazapi (heliobot / 5521991913946) ao tenant acme-teste-1.
 * Uso: npx tsx scripts/register-uazapi-acme.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import postgres from "postgres";

const TENANT = "abb28c63-6231-4a5a-beec-80b93054bf6f"; // acme-teste-1

const INSTANCE = {
  name: "rd5de07cceec96e",
  token: "d7db5ff9-a73b-4dda-9808-3b1125971b3c",
  phone: "5521991913946",
  serverUrl: "https://growthhub.uazapi.com",
  label: "Uazapi acme (heliobot)",
};

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { prepare: false, max: 1 });

  const deactivated = await sql<{ id: string; label: string }[]>`
    UPDATE public.whatsapp_number
    SET is_active = false
    WHERE tenant_id = ${TENANT} AND is_active = true
    RETURNING id, label
  `;
  if (deactivated.length > 0) {
    console.log(`Desativadas ${deactivated.length} outra(s) wn:`);
    deactivated.forEach((d) => console.log(`  • ${d.label}`));
  }

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM public.whatsapp_number
    WHERE tenant_id = ${TENANT} AND phone_number = ${INSTANCE.phone}
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE public.whatsapp_number
      SET label = ${INSTANCE.label},
          uazapi_session = ${INSTANCE.name},
          uazapi_token = ${INSTANCE.token},
          server_url = ${INSTANCE.serverUrl},
          is_active = true
      WHERE id = ${existing[0].id}
    `;
    console.log(`✓ Atualizado wn existente ${existing[0].id}`);
  } else {
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO public.whatsapp_number
        (tenant_id, label, phone_number, uazapi_session, uazapi_token, server_url, is_active)
      VALUES
        (${TENANT}, ${INSTANCE.label}, ${INSTANCE.phone}, ${INSTANCE.name}, ${INSTANCE.token}, ${INSTANCE.serverUrl}, true)
      RETURNING id
    `;
    console.log(`✓ wn criado ${created.id}`);
  }

  const final = await sql<{ label: string; phone_number: string; uazapi_session: string; server_url: string; is_active: boolean }[]>`
    SELECT label, phone_number, uazapi_session, server_url, is_active
    FROM public.whatsapp_number
    WHERE tenant_id = ${TENANT}
    ORDER BY is_active DESC
  `;
  console.log("\nEstado final acme-teste-1:");
  final.forEach((w) =>
    console.log(`  ${w.is_active ? "✓" : "✗"} ${w.label} | session=${w.uazapi_session} | ${w.phone_number} | ${w.server_url}`)
  );

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
