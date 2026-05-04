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

  // 1) Acha todos users elevated (superadmin OU partner_admin)
  const { data: elevatedRows, error: e1 } = await sb
    .from("user_tenant")
    .select("user_id, tenant_id, role")
    .in("role", ["partner_admin", "superadmin"]);
  if (e1) {
    console.error("Falha listando elevated users:", e1.message);
    process.exit(1);
  }
  if (!elevatedRows || elevatedRows.length === 0) {
    console.log("Nenhum elevated user encontrado.");
    return;
  }

  // Dedup por user_id (pode aparecer várias vezes se for elevated em vários tenants)
  const userIds = Array.from(new Set((elevatedRows as { user_id: string }[]).map((r) => r.user_id)));
  console.log(`Elevated users encontrados: ${userIds.length}\n`);

  let totalDeletes = 0;
  let totalDefaultFixes = 0;

  for (const userId of userIds) {
    const { data: userRow } = await sb
      .from("user")
      .select("id, name, email")
      .eq("id", userId)
      .single();
    const u = userRow as { id: string; name: string; email: string } | null;

    // Pega TODOS user_tenant deste user com info dos tenants
    const { data: allUt } = await sb
      .from("user_tenant")
      .select("id, user_id, tenant_id, role, is_default, created_at")
      .eq("user_id", userId);
    const bindings = (allUt ?? []) as UtRow[];

    if (bindings.length === 1) continue; // single binding, sem problema

    const tenantIds = bindings.map((b) => b.tenant_id);
    const { data: tenantsRaw } = await sb
      .from("tenant")
      .select("id, slug, name, is_platform_owner, is_partner, partner_id")
      .in("id", tenantIds);
    const tenants = (tenantsRaw ?? []) as TenantRow[];
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    // Determina home tenant deste user (em ordem de prioridade):
    //  1. tenant onde user é superadmin + tenant.is_platform_owner=true → gh
    //  2. tenant onde user é superadmin → outro com role superadmin
    //  3. tenant onde user é partner_admin + tenant.is_partner=true → o home do parceiro
    //  4. fallback: o mais antigo
    const sortedByCreation = [...bindings].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const superInPlatform = bindings.find(
      (b) => b.role === "superadmin" && tenantMap.get(b.tenant_id)?.is_platform_owner
    );
    const anySuper = bindings.find((b) => b.role === "superadmin");
    const partnerInPartner = bindings.find(
      (b) => b.role === "partner_admin" && tenantMap.get(b.tenant_id)?.is_partner
    );
    const homeBinding = superInPlatform ?? anySuper ?? partnerInPartner ?? sortedByCreation[0];
    const home = tenantMap.get(homeBinding.tenant_id);
    if (!home) continue;

    console.log(`─ ${u?.name ?? "?"} <${u?.email ?? userId}>`);
    console.log(`   Home detectado: ${home.slug} (role=${homeBinding.role}, platform_owner=${home.is_platform_owner}, partner=${home.is_partner})`);
    console.log(`   Total bindings: ${bindings.length}`);

    const wrongBindings: UtRow[] = [];
    for (const b of bindings) {
      const t = tenantMap.get(b.tenant_id);
      if (!t) continue;
      // Wrong = role='admin' em tenant cujo partner_id aponta pra UM dos tenants do user
      // (= user virou admin do cliente que ele criou)
      const userOwnsThisPartner = bindings.some(
        (other) =>
          (other.role === "partner_admin" || other.role === "superadmin") &&
          other.tenant_id === t.partner_id
      );
      const isWrongAdmin = b.role === "admin" && userOwnsThisPartner;
      console.log(
        `   ${isWrongAdmin ? "✗" : " "} [${b.role.padEnd(13)}] ${t.slug.padEnd(30)} ` +
        `is_default=${b.is_default} created=${b.created_at.slice(0, 10)}` +
        (b.id === homeBinding.id ? "  ← HOME" : "")
      );
      if (isWrongAdmin) wrongBindings.push(b);
    }

    const needsHomeDefault = !homeBinding.is_default;
    const otherTrueDefaults = bindings.filter(
      (b) => b.is_default && b.id !== homeBinding.id && !wrongBindings.some((w) => w.id === b.id)
    );

    if (wrongBindings.length === 0 && !needsHomeDefault && otherTrueDefaults.length === 0) {
      console.log(`   ✓ Estado OK — nenhuma mudança necessária\n`);
      continue;
    }

    console.log(`   PLANO:`);
    for (const w of wrongBindings) {
      const t = tenantMap.get(w.tenant_id);
      console.log(`     - DELETE binding errado (${u?.email} ↔ ${t?.slug})`);
    }
    if (needsHomeDefault) {
      console.log(`     - SET is_default=true em binding home (${home.slug})`);
    }
    for (const b of otherTrueDefaults) {
      const t = tenantMap.get(b.tenant_id);
      console.log(`     - SET is_default=false em ${t?.slug ?? b.tenant_id}`);
    }

    if (confirm) {
      for (const w of wrongBindings) {
        const { error } = await sb.from("user_tenant").delete().eq("id", w.id);
        if (error) console.error(`     ! Delete falhou: ${error.message}`);
        else totalDeletes++;
      }
      // Normaliza defaults: zera todos, depois marca só o home
      await sb.from("user_tenant").update({ is_default: false }).eq("user_id", userId);
      const { error } = await sb
        .from("user_tenant")
        .update({ is_default: true })
        .eq("id", homeBinding.id);
      if (!error) totalDefaultFixes++;
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
