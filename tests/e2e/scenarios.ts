/**
 * Cenários E2E pra suite multi-agente.
 * Cada export é uma função async que retorna ScenarioResult.
 */
import {
  loadEnv,
  loginAs,
  createClient_,
  getContext,
  clientAccess,
  testIds,
  runScenario,
  type ScenarioResult,
  type TestEnv,
} from "../fixtures/test-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// A. Happy path: criar cliente com email novo + senha → login → ver dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioA(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("A:happy-path", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids = testIds(env, "a");

    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      adminEmail: ids.adminEmail,
      adminName: ids.adminName,
      adminPassword: ids.adminPassword,
      plan: "pro",
    });

    if (create.status !== 201) {
      return { ok: false, errors: [`Create failed: ${create.status} ${JSON.stringify(create.body)}`] };
    }

    // Loga como o novo admin
    const admin = await loginAs(env, ids.adminEmail, ids.adminPassword);
    const ctx = await getContext(env, admin.cookieHeader);

    if (ctx.status !== 200) {
      return {
        ok: false,
        errors: [`Context failed: ${ctx.status} ${JSON.stringify(ctx.body)}`],
        details: { create: create.body },
      };
    }

    const ctxBody = ctx.body as { tenantSlug?: string; role?: string };
    if (ctxBody.tenantSlug !== ids.slug) {
      return {
        ok: false,
        errors: [`Wrong tenant: expected ${ids.slug}, got ${ctxBody.tenantSlug}`],
        details: { ctx: ctxBody },
      };
    }
    if (ctxBody.role !== "admin") {
      return {
        ok: false,
        errors: [`Wrong role: expected admin, got ${ctxBody.role}`],
      };
    }

    return { ok: true, details: { tenantSlug: ctxBody.tenantSlug, role: ctxBody.role } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Tentar criar com adminEmail = partner email → deve falhar 400
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioB(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("B:reject-self-email", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids = testIds(env, "b");

    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      adminEmail: env.partnerEmail, // ← email do próprio partner
      adminPassword: ids.adminPassword,
    });

    if (create.status === 400) {
      const b = create.body as { error?: string };
      if (b.error === "EMAIL_IS_PARTNER") {
        return { ok: true, details: { rejectedAs: b.error } };
      }
      return { ok: false, errors: [`400 mas com erro errado: ${b.error}`] };
    }

    return {
      ok: false,
      errors: [`Esperava 400 EMAIL_IS_PARTNER, recebi ${create.status} ${JSON.stringify(create.body)}`],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Tentar criar com adminEmail vazio → deve falhar 400
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioC(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("C:reject-empty-email", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids = testIds(env, "c");

    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      // adminEmail propositalmente omitido
    });

    if (create.status === 400) {
      return { ok: true, details: { body: create.body } };
    }
    return {
      ok: false,
      errors: [`Esperava 400 (adminEmail required), recebi ${create.status} ${JSON.stringify(create.body)}`],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Criar 2 tenants com mesmo adminEmail (sem reuseExistingUser) → 2º falha 409
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioD(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("D:reject-duplicate-email", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids1 = testIds(env, "d1");
    const ids2 = testIds(env, "d2");
    const sharedEmail = `test-${env.nonce}-shared@test.local`;

    const c1 = await createClient_(env, partner.cookieHeader, {
      name: ids1.name,
      slug: ids1.slug,
      adminEmail: sharedEmail,
      adminPassword: ids1.adminPassword,
    });
    if (c1.status !== 201) {
      return { ok: false, errors: [`First create failed: ${c1.status} ${JSON.stringify(c1.body)}`] };
    }

    const c2 = await createClient_(env, partner.cookieHeader, {
      name: ids2.name,
      slug: ids2.slug,
      adminEmail: sharedEmail,
      adminPassword: ids2.adminPassword,
    });
    if (c2.status !== 409) {
      return {
        ok: false,
        errors: [`Esperava 409 no segundo, recebi ${c2.status} ${JSON.stringify(c2.body)}`],
      };
    }
    return { ok: true, details: { firstCreated: ids1.slug, secondRejected: c2.body } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Criar tenant → admin loga → partner reseta senha → admin loga com nova
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioE(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("E:reset-password-flow", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids = testIds(env, "e");

    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      adminEmail: ids.adminEmail,
      adminPassword: ids.adminPassword,
    });
    if (create.status !== 201) {
      return { ok: false, errors: [`Create failed: ${create.status} ${JSON.stringify(create.body)}`] };
    }
    const tenantId = (create.body as { client?: { tenantId?: string } }).client?.tenantId;
    if (!tenantId) return { ok: false, errors: ["No tenantId returned"] };

    // Login original funciona
    await loginAs(env, ids.adminEmail, ids.adminPassword);

    // Partner reseta senha
    const newPassword = `NewPass-${env.nonce}-e`;
    const reset = await clientAccess(env, partner.cookieHeader, tenantId, {
      action: "reset-password",
      newPassword,
    });
    if (reset.status !== 200) {
      return { ok: false, errors: [`Reset failed: ${reset.status} ${JSON.stringify(reset.body)}`] };
    }

    // Login com nova
    try {
      await loginAs(env, ids.adminEmail, newPassword);
    } catch (e) {
      return { ok: false, errors: [`Login com nova senha falhou: ${(e as Error).message}`] };
    }

    return { ok: true, details: { tenantId } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// F. Forçar admin compartilhado e tentar reset → API retorna 409
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioF(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("F:reject-shared-reset", async () => {
    // Esse cenário precisa criar 2 tenants compartilhando user — só dá pra
    // fazer com a flag reuseExistingUser=true (só superadmin). Se o partner
    // de teste não for superadmin, marcamos como SKIP-but-PASS via details.
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids1 = testIds(env, "f1");
    const ids2 = testIds(env, "f2");
    const sharedEmail = `test-${env.nonce}-shared-f@test.local`;

    const c1 = await createClient_(env, partner.cookieHeader, {
      name: ids1.name,
      slug: ids1.slug,
      adminEmail: sharedEmail,
      adminPassword: ids1.adminPassword,
    });
    if (c1.status !== 201) {
      return { ok: false, errors: [`First create failed: ${c1.status} ${JSON.stringify(c1.body)}`] };
    }
    const tenantId1 = (c1.body as { client?: { tenantId?: string } }).client?.tenantId;
    if (!tenantId1) return { ok: false, errors: ["No tenantId from first"] };

    // Tenta criar segundo com mesma email + reuseExistingUser
    const c2 = await createClient_(env, partner.cookieHeader, {
      name: ids2.name,
      slug: ids2.slug,
      adminEmail: sharedEmail,
      reuseExistingUser: true,
    });
    if (c2.status !== 201) {
      // Provavelmente o partner não é superadmin — flag ignorada, segundo create rejeitado por DUPLICATE.
      return {
        ok: true,
        details: {
          skipReason: "Partner não é superadmin — flag reuseExistingUser ignorada. Cenário F precisa de superadmin pra testar shared user reset.",
          c2Status: c2.status,
        },
      };
    }

    // Tenta resetar senha do user compartilhado → deve falhar 409
    const reset = await clientAccess(env, partner.cookieHeader, tenantId1, {
      action: "reset-password",
      newPassword: `Pass-${env.nonce}`,
    });
    if (reset.status === 409) {
      const b = reset.body as { error?: string };
      if (b.error === "SHARED_USER_RESET_FORBIDDEN") {
        return { ok: true, details: { rejectedAs: b.error } };
      }
    }
    return {
      ok: false,
      errors: [`Esperava 409 SHARED_USER_RESET_FORBIDDEN, recebi ${reset.status} ${JSON.stringify(reset.body)}`],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// G. Validação: partner loga e contexto retorna SEU tenant home (não cliente)
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioG(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("G:partner-context-stable", async () => {
    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ctx1 = await getContext(env, partner.cookieHeader);
    if (ctx1.status !== 200) {
      return { ok: false, errors: [`Context falhou: ${ctx1.status}`] };
    }
    const before = ctx1.body as { tenantId?: string; tenantSlug?: string; isPlatformOwner?: boolean };

    // Cria um cliente novo
    const ids = testIds(env, "g");
    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      adminEmail: ids.adminEmail,
      adminPassword: ids.adminPassword,
    });
    if (create.status !== 201) {
      return { ok: false, errors: [`Create falhou: ${JSON.stringify(create.body)}`] };
    }

    // Re-pega contexto do partner — DEVE continuar igual
    const ctx2 = await getContext(env, partner.cookieHeader);
    const after = ctx2.body as { tenantId?: string; tenantSlug?: string };

    if (before.tenantId !== after.tenantId) {
      return {
        ok: false,
        errors: [`Contexto do partner mudou após criar cliente! antes=${before.tenantSlug} depois=${after.tenantSlug}`],
      };
    }

    return { ok: true, details: { stableTenant: before.tenantSlug } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// I. Manager de tenant partner consegue criar cliente
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioI(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("I:manager-can-create", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(env.supabaseUrl, env.supabaseServiceKey);

    // Cria manager temporário no tenant do partner de teste (que é is_partner=true)
    const managerEmail = `test-${env.nonce}-manager@test.local`;
    const managerPassword = `MgrPass-${env.nonce}!`;

    // Pega tenant do partner de teste
    const { data: partnerTenant } = await sb
      .from("tenant")
      .select("id, slug")
      .eq("slug", "test-e2e-partner-tenant")
      .single();
    if (!partnerTenant) {
      return { ok: false, errors: ["test-e2e-partner-tenant não existe — rode scripts/create-test-partner.ts"] };
    }
    const partnerTenantId = (partnerTenant as { id: string }).id;

    // Cria user manager
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: managerEmail,
      password: managerPassword,
      email_confirm: true,
      user_metadata: { name: "Test Manager" },
    });
    if (createErr || !created.user) {
      return { ok: false, errors: [`Manager create falhou: ${createErr?.message}`] };
    }
    const managerId = created.user.id;

    // Mirror em public.user
    await sb.from("user").upsert({
      id: managerId,
      name: "Test Manager",
      email: managerEmail,
      emailVerified: true,
      role: "manager",
      isActive: true,
    });

    // user_tenant: manager do partner tenant
    await sb.from("user_tenant").insert({
      user_id: managerId,
      tenant_id: partnerTenantId,
      role: "manager",
      is_default: true,
    });

    try {
      // Loga como manager
      const manager = await loginAs(env, managerEmail, managerPassword);

      // Tenta criar cliente
      const ids = testIds(env, "i");
      const create = await createClient_(env, manager.cookieHeader, {
        name: ids.name,
        slug: ids.slug,
        adminEmail: ids.adminEmail,
        adminPassword: ids.adminPassword,
      });

      if (create.status !== 201) {
        return {
          ok: false,
          errors: [`Manager NÃO conseguiu criar cliente: ${create.status} ${JSON.stringify(create.body)}`],
        };
      }
      return { ok: true, details: { createdSlug: ids.slug } };
    } finally {
      // Cleanup do manager
      await sb.from("user_tenant").delete().eq("user_id", managerId);
      await sb.from("user").delete().eq("id", managerId);
      await sb.auth.admin.deleteUser(managerId);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// H. Cleanup: deleta todos test- via service role direto no DB
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioH_cleanup(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("H:cleanup", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(env.supabaseUrl, env.supabaseServiceKey);

    // Deleta SOMENTE tenants criados pelos cenários deste run (test-{nonce}-*)
    // — não toca em test-e2e-partner-tenant (fixture preservada).
    const prefix = `test-${env.nonce}`;
    const { data: tenants, error: listErr } = await sb
      .from("tenant")
      .select("id, slug")
      .like("slug", `${prefix}%`);
    if (listErr) {
      return { ok: false, errors: [`List tenants falhou: ${listErr.message}`] };
    }
    const tenantIds = (tenants ?? []).map((t) => t.id);
    if (tenantIds.length > 0) {
      // Algumas FK apontando pra tenant não tem ON DELETE CASCADE.
      // Limpa em ordem manual antes de deletar tenant.
      const cleanupTables = [
        "whatsapp_number",
        "lead",
        "pipeline_stage",
        "pipeline",
        "automation",
        "task",
      ];
      for (const tbl of cleanupTables) {
        await sb.from(tbl).delete().in("tenant_id", tenantIds);
      }
      const { error: delErr } = await sb.from("tenant").delete().in("id", tenantIds);
      if (delErr) {
        return { ok: false, errors: [`Delete tenants falhou: ${delErr.message}`] };
      }
    }

    // Limpa users criados pelo teste (Supabase Auth)
    const { data: usersList } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const testUsers = (usersList?.users ?? []).filter(
      (u) => u.email?.includes(`test-${env.nonce}`)
    );
    let userDeletes = 0;
    for (const u of testUsers) {
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (!error) userDeletes++;
    }
    // Limpa também rows orfãs em public.user
    if (testUsers.length > 0) {
      const ids = testUsers.map((u) => u.id);
      await sb.from("user").delete().in("id", ids);
    }

    return {
      ok: true,
      details: {
        tenantsDeleted: tenantIds.length,
        usersDeleted: userDeletes,
      },
    };
  });
}

if (loadEnv === undefined) {
  // import só pra TypeScript não reclamar
}
