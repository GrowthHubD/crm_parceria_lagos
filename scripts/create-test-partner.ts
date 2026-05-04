/**
 * Cria um partner de teste isolado pra rodar a suite E2E sem precisar
 * de credenciais reais do partner do user. Idempotente — se já existe, reusa.
 *
 * Output: imprime as credenciais que devem ser colocadas no .env.local
 *   TEST_PARTNER_EMAIL=...
 *   TEST_PARTNER_PASSWORD=...
 *
 * Pré-requisitos: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam env vars");
  process.exit(1);
}

const sb = createClient(url, key);

const TEST_EMAIL = "test-e2e-partner@test.local";
const TEST_PASSWORD = "TestPartnerE2E-Pass123!";
const TEST_TENANT_SLUG = "test-e2e-partner-tenant";
const TEST_TENANT_NAME = "Test E2E Partner Tenant";

async function main() {
  // 1) Garante tenant
  const { data: existingTenant } = await sb
    .from("tenant")
    .select("id, slug")
    .eq("slug", TEST_TENANT_SLUG)
    .maybeSingle();

  let tenantId: string;
  if (existingTenant) {
    tenantId = (existingTenant as { id: string }).id;
    console.log(`Tenant test reused: ${tenantId}`);
  } else {
    const { data: newT, error: tErr } = await sb
      .from("tenant")
      .insert({
        name: TEST_TENANT_NAME,
        slug: TEST_TENANT_SLUG,
        is_platform_owner: false,
        is_partner: true,
        plan: "enterprise",
        status: "active",
      })
      .select("id")
      .single();
    if (tErr || !newT) {
      console.error("Tenant create falhou:", tErr?.message);
      process.exit(1);
    }
    tenantId = (newT as { id: string }).id;
    console.log(`Tenant test criado: ${tenantId}`);
  }

  // 2) Garante user no Supabase Auth
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users?.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "E2E Test Partner" },
    });
    if (error || !created.user) {
      console.error("User create falhou:", error?.message);
      process.exit(1);
    }
    user = created.user;
    console.log(`User criado: ${user.id}`);
  } else {
    // Garante senha conhecida
    await sb.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
    console.log(`User reused: ${user.id} (senha resetada)`);
  }

  // 3) Garante public.user
  await sb.from("user").upsert({
    id: user.id,
    name: "E2E Test Partner",
    email: TEST_EMAIL,
    emailVerified: true,
    role: "partner_admin",
    isActive: true,
  });

  // 4) Garante user_tenant com role=partner_admin
  const { data: existingUt } = await sb
    .from("user_tenant")
    .select("id, role, is_default")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existingUt) {
    await sb.from("user_tenant").insert({
      user_id: user.id,
      tenant_id: tenantId,
      role: "partner_admin",
      is_default: true,
    });
    console.log(`user_tenant criado: partner_admin de ${TEST_TENANT_SLUG}`);
  } else {
    await sb
      .from("user_tenant")
      .update({ role: "partner_admin", is_default: true })
      .eq("id", (existingUt as { id: string }).id);
    console.log(`user_tenant reused`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Adicione no .env.local:");
  console.log(`TEST_TARGET_URL=https://crm.methodgrowthhub.com.br`);
  console.log(`TEST_PARTNER_EMAIL=${TEST_EMAIL}`);
  console.log(`TEST_PARTNER_PASSWORD=${TEST_PASSWORD}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("Crash:", e);
  process.exit(1);
});
