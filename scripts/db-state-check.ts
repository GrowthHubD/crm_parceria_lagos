/**
 * Lista o estado atual do banco pra validar o que mudou no db:push.
 * Mostra: contagem de tenants, users, user_tenant, e se o uniqueIndex
 * uq_user_tenant_default foi aplicado.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const tables = ["tenant", "user", "user_tenant", "whatsapp_number", "pipeline", "lead"];
  console.log("Contagens:");
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(20)} ${error ? `ERROR: ${error.message}` : count}`);
  }

  // Lista users e bindings
  console.log("\nUsers:");
  const { data: users } = await sb.from("user").select("id, email, name, role").order("createdAt");
  for (const u of (users ?? []) as { id: string; email: string; name: string; role: string }[]) {
    console.log(`  ${u.email.padEnd(50)} role=${u.role}`);
  }

  console.log("\nTenants:");
  const { data: tenants } = await sb
    .from("tenant")
    .select("id, slug, name, is_platform_owner, is_partner, partner_id, status");
  for (const t of (tenants ?? []) as { slug: string; is_platform_owner: boolean; is_partner: boolean; partner_id: string | null; status: string }[]) {
    const flags = [
      t.is_platform_owner ? "PLATFORM" : "",
      t.is_partner ? "PARTNER" : "",
      t.partner_id ? "→client" : "",
    ].filter(Boolean).join("|") || "tenant";
    console.log(`  ${t.slug.padEnd(35)} [${flags}] status=${t.status}`);
  }

  // Bindings
  console.log("\nUser → Tenant bindings:");
  const { data: bindings } = await sb
    .from("user_tenant")
    .select("user_id, tenant_id, role, is_default");
  for (const b of (bindings ?? []) as { user_id: string; tenant_id: string; role: string; is_default: boolean }[]) {
    const u = (users ?? []).find((x) => (x as { id: string }).id === b.user_id) as { email?: string } | undefined;
    const t = (tenants ?? []).find((x) => (x as { id: string }).id === b.tenant_id) as { slug?: string } | undefined;
    console.log(`  ${(u?.email ?? "?").padEnd(45)} ↔ ${(t?.slug ?? "?").padEnd(35)} ${b.role.padEnd(15)} default=${b.is_default}`);
  }

  // Verifica unique index
  const { data: idx } = await sb.rpc("pg_indexes_table" as never, { table_name: "user_tenant" }).select().maybeSingle().then(
    (r: { data: unknown }) => r,
    () => ({ data: null })
  );
  if (idx) console.log("\nIndexes em user_tenant:", idx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
