/**
 * scripts/fix-uazapi-instance.ts
 *
 * Conserta credenciais Uazapi de um tenant (whatsapp_number row) quando a
 * instância foi recriada / migrada de server e o DB ficou stale.
 *
 * Uso: SET as 4 constants no topo e rodar:
 *   npx tsx scripts/fix-uazapi-instance.ts
 */
import "dotenv/config";
import postgres from "postgres";

// === EDITAR ANTES DE RODAR ===
const TENANT_SLUG = "alexandre"; // slug exato do tenant em public.tenant
const NEW_TOKEN = "d3f8ac7d-28d6-4dca-9e45-c7d086f5e555";
const NEW_SERVER_URL = "https://montanha.uazapi.com";
const NEW_PHONE = "554196409408";
// =============================

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    // 1) Acha o tenant pelo slug exato
    const tenants = await sql<Array<{ id: string; slug: string; name: string }>>`
      SELECT id, slug, name FROM public.tenant WHERE slug = ${TENANT_SLUG} LIMIT 1
    `;
    if (tenants.length === 0) {
      console.error(`✗ Tenant slug "${TENANT_SLUG}" não existe`);
      return;
    }
    const tenant = { tenantId: tenants[0].id, tenantSlug: tenants[0].slug, tenantName: tenants[0].name };
    console.log(`\n→ Tenant: ${tenant.tenantSlug} (${tenant.tenantName}) — ${tenant.tenantId}`);

    // 3) Acha o whatsapp_number desse tenant
    const numbers = await sql<Array<{ id: string; label: string; phone: string; session: string; token: string; server: string | null; active: boolean }>>`
      SELECT id, label, phone_number AS phone, uazapi_session AS session,
             SUBSTRING(uazapi_token, 1, 20) || '...' AS token,
             server_url AS server, is_active AS active
      FROM public.whatsapp_number
      WHERE tenant_id = ${tenant.tenantId}
    `;
    console.log(`\n→ whatsapp_number do tenant ${tenant.tenantSlug} (${numbers.length}):`);
    for (const n of numbers) {
      console.log(`  id=${n.id}`);
      console.log(`    label=${n.label}  phone=${n.phone}  active=${n.active}`);
      console.log(`    session=${n.session}  token=${n.token}  server=${n.server ?? "(default)"}`);
    }
    if (numbers.length === 0) {
      console.error("✗ Nenhum whatsapp_number — criar antes de atualizar");
      return;
    }
    const num = numbers[0];

    // 4) Verifica se já existe outro number com mesmo phone (constraint unique)
    const phoneClash = await sql<Array<{ id: string; tenantId: string }>>`
      SELECT id, tenant_id AS "tenantId" FROM public.whatsapp_number
      WHERE phone_number = ${NEW_PHONE} AND id != ${num.id}
    `;
    if (phoneClash.length > 0) {
      console.warn(`⚠ Phone ${NEW_PHONE} já está em outro number (${phoneClash[0].id}, tenant ${phoneClash[0].tenantId}).`);
      console.warn("  Atualizando SEM mexer no phone (deixa o existente). Reconexão real precisa resolver o conflito.");
    }

    // 5) UPDATE
    console.log(`\n→ Aplicando UPDATE no whatsapp_number ${num.id}:`);
    console.log(`    uazapi_token  = ${NEW_TOKEN.slice(0, 20)}...`);
    console.log(`    server_url    = ${NEW_SERVER_URL}`);
    console.log(`    is_active     = true`);
    if (phoneClash.length === 0) {
      console.log(`    phone_number  = ${NEW_PHONE}`);
      await sql`
        UPDATE public.whatsapp_number
        SET uazapi_token = ${NEW_TOKEN},
            server_url   = ${NEW_SERVER_URL},
            phone_number = ${NEW_PHONE},
            is_active    = true
        WHERE id = ${num.id}
      `;
    } else {
      console.log(`    phone_number  = (mantido)`);
      await sql`
        UPDATE public.whatsapp_number
        SET uazapi_token = ${NEW_TOKEN},
            server_url   = ${NEW_SERVER_URL},
            is_active    = true
        WHERE id = ${num.id}
      `;
    }
    console.log("✓ UPDATE aplicado");

    // 5) Confirma
    const after = await sql<Array<{ phone: string; session: string; token: string; server: string | null; active: boolean }>>`
      SELECT phone_number AS phone, uazapi_session AS session,
             SUBSTRING(uazapi_token, 1, 20) || '...' AS token,
             server_url AS server, is_active AS active
      FROM public.whatsapp_number WHERE id = ${num.id}
    `;
    console.log("\n→ Estado pós-UPDATE:");
    console.log(JSON.stringify(after[0], null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
