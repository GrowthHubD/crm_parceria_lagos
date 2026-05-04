/**
 * Cleanup destrutivo do estado quebrado do Helio (e qualquer partner_admin
 * que tenha vínculos errados em tenants de cliente por causa do bug de
 * provisioning antigo).
 *
 * O QUE FAZ:
 *   1. Acha todos partner_admin (user com role='partner_admin' em algum user_tenant)
 *   2. Pra cada um, lista TODOS os user_tenant
 *   3. Identifica vínculos "errados": role='admin' em tenant cujo partnerId === o tenant home do partner
 *      (= partner virou admin do cliente que ele mesmo criou)
 *   4. Mostra plano de mudanças
 *   5. Se --confirm passado, executa: deleta os vínculos errados + garante is_default=true no home tenant
 *
 * Uso:
 *   tsx scripts/cleanup-helio.ts                # dry-run (só mostra)
 *   tsx scripts/cleanup-helio.ts --confirm      # executa
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const sb = createClient(url, key);

interface UtRow {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  is_default: boolean;
  created_at: string;
}
interface TenantRow {
  id: string;
  slug: string;
  name: string;
  is_platform_owner: boolean;
  is_partner: boolean;
  partner_id: string | null;
}

async function main() {
  console.log("━".repeat(72));
  console.log(`Cleanup Helio — modo: ${confirm ? "EXECUTAR" : "DRY RUN"}`);
  console.log("━".repeat(72));

  // 1) Acha todos user_tenant role='partner_admin'
  const { data: partnerRows, error: e1 } = await sb
    .from("user_tenant")
    .select("user_id, tenant_id, role")
    .eq("role", "partner_admin");
  if (e1) {
    console.error("Falha listando partner_admins:", e1.message);
    process.exit(1);
  }
  if (!partnerRows || partnerRows.length === 0) {
    console.log("Nenhum partner_admin encontrado.");
    return;
  }

  const partners = partnerRows as { user_id: string; tenant_id: string; role: string }[];
  console.log(`Partner_admins encontrados: ${partners.length}\n`);

  let totalDeletes = 0;
  let totalDefaultFixes = 0;

  for (const p of partners) {
    // Pega info do user
    const { data: userRow } = await sb
      .from("user")
      .select("id, name, email")
      .eq("id", p.user_id)
      .single();
    const u = userRow as { id: string; name: string; email: string } | null;

    // Pega home tenant
    const { data: homeT } = await sb
      .from("tenant")
      .select("id, slug, name, is_platform_owner, is_partner, partner_id")
      .eq("id", p.tenant_id)
      .single();
    const home = homeT as TenantRow | null;
    if (!home) continue;

    // Pega TODOS user_tenant deste user
    const { data: allUt } = await sb
      .from("user_tenant")
      .select("id, user_id, tenant_id, role, is_default, created_at")
      .eq("user_id", p.user_id);
    const bindings = (allUt ?? []) as UtRow[];

    if (bindings.length === 1) continue; // single binding, sem problema

    console.log(`─ ${u?.name ?? "?"} <${u?.email ?? p.user_id}>`);
    console.log(`   Home tenant: ${home.slug} (id=${home.id})`);
    console.log(`   Total bindings: ${bindings.length}`);

    // Pega tenants alvos
    const tenantIds = bindings.map((b) => b.tenant_id);
    const { data: tenantsRaw } = await sb
      .from("tenant")
      .select("id, slug, name, is_platform_owner, is_partner, partner_id")
      .in("id", tenantIds);
    const tenants = (tenantsRaw ?? []) as TenantRow[];
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    const wrongBindings: UtRow[] = [];
    for (const b of bindings) {
      const t = tenantMap.get(b.tenant_id);
      if (!t) continue;
      const isWrongAdmin = b.role === "admin" && t.partner_id === home.id;
      console.log(
        `   ${isWrongAdmin ? "✗" : " "} [${b.role.padEnd(13)}] ${t.slug.padEnd(30)} ` +
        `is_default=${b.is_default} created=${b.created_at.slice(0, 10)}`
      );
      if (isWrongAdmin) wrongBindings.push(b);
    }

    // Plano: deletar wrongBindings + garantir is_default=true no home
    if (wrongBindings.length > 0) {
      console.log(`   PLANO:`);
      for (const w of wrongBindings) {
        const t = tenantMap.get(w.tenant_id);
        console.log(`     - DELETE user_tenant id=${w.id} (${u?.email} ↔ ${t?.slug})`);
      }
    }

    // Garante is_default=true no home, false em outros válidos
    const homeBinding = bindings.find((b) => b.tenant_id === home.id);
    if (homeBinding && !homeBinding.is_default) {
      console.log(`     - SET is_default=true em binding home (${home.slug})`);
    }
    const otherTrueDefaults = bindings.filter(
      (b) => b.is_default && b.tenant_id !== home.id && !wrongBindings.some((w) => w.id === b.id)
    );
    for (const b of otherTrueDefaults) {
      const t = tenantMap.get(b.tenant_id);
      console.log(`     - SET is_default=false em binding ${t?.slug ?? b.tenant_id}`);
    }

    if (confirm) {
      // Executa
      for (const w of wrongBindings) {
        const { error } = await sb.from("user_tenant").delete().eq("id", w.id);
        if (error) console.error(`     ! Delete falhou: ${error.message}`);
        else totalDeletes++;
      }
      // Reset all is_default → false
      await sb.from("user_tenant").update({ is_default: false }).eq("user_id", p.user_id);
      // Set home como default
      if (homeBinding) {
        const { error } = await sb
          .from("user_tenant")
          .update({ is_default: true })
          .eq("id", homeBinding.id);
        if (!error) totalDefaultFixes++;
      }
    }

    console.log();
  }

  console.log("━".repeat(72));
  if (confirm) {
    console.log(`✓ Executado: ${totalDeletes} bindings deletados, ${totalDefaultFixes} defaults restaurados`);
  } else {
    console.log("DRY RUN — nenhuma mudança aplicada. Re-rode com --confirm pra executar.");
  }
  console.log("━".repeat(72));
}

main().catch((e) => {
  console.error("Crash:", e);
  process.exit(1);
});
