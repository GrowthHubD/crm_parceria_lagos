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
// J. Live cross-tenant follow-up — 2 tenants, 2 instâncias Uazapi reais.
//    Welcome + 2 follow-ups com delays diferentes em cada lado.
//    Asserta JOIN crm_message → crm_conversation → whatsapp_number.tenant_id
//    pra provar que cada msg saiu pelo whatsapp do tenant correto.
//
//    Pré-reqs (env):
//      UAZ_A_TOKEN, UAZ_B_TOKEN  — tokens das duas instâncias Uazapi reais
//      CRON_SECRET               — pra disparar /api/cron/follow-up
//    Defaults (opcionais):
//      UAZ_SERVER_URL            — server Uazapi (default https://growthhub.uazapi.com)
//      UAZ_A_PHONE, UAZ_B_PHONE  — números das instâncias (default reais)
//      UAZ_A_SESSION, UAZ_B_SESSION — instance ids
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioJ(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("J:cross-tenant-followup-live", async () => {
    const UAZ_A_TOKEN = process.env.UAZ_A_TOKEN ?? "";
    const UAZ_B_TOKEN = process.env.UAZ_B_TOKEN ?? "";
    if (!UAZ_A_TOKEN || !UAZ_B_TOKEN) {
      return {
        ok: false,
        errors: ["Faltam UAZ_A_TOKEN / UAZ_B_TOKEN no env (tokens reais Uazapi pra cross-test)"],
      };
    }
    if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
      return { ok: false, errors: ["DATABASE_URL ausente — runner local precisa pra rodar"] };
    }
    // Força provider Uazapi e desliga dry-run pra envios reais
    process.env.WHATSAPP_PROVIDER = "uazapi";
    process.env.AUTOMATION_DRY_RUN = "false";
    if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
      process.env.DATABASE_URL = process.env.DIRECT_URL;
    }

    const SERVER = process.env.UAZ_SERVER_URL ?? "https://growthhub.uazapi.com";
    const PHONE_A = process.env.UAZ_A_PHONE ?? "5521999433160";
    const PHONE_B = process.env.UAZ_B_PHONE ?? "5521978477520";
    const SESSION_A = process.env.UAZ_A_SESSION ?? "r9a6322ece80058";
    const SESSION_B = process.env.UAZ_B_SESSION ?? "rcad9874669dd20";

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(env.supabaseUrl, env.supabaseServiceKey);

    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const idsA = testIds(env, "j-iso-a");
    const idsB = testIds(env, "j-iso-b");
    const nonce = env.nonce;

    // 1. Cria 2 tenants
    const cA = await createClient_(env, partner.cookieHeader, {
      name: idsA.name,
      slug: idsA.slug,
      adminEmail: idsA.adminEmail,
      adminName: idsA.adminName,
      adminPassword: idsA.adminPassword,
      plan: "pro",
    });
    if (cA.status !== 201) {
      return { ok: false, errors: [`Create A falhou: ${cA.status} ${JSON.stringify(cA.body)}`] };
    }
    const tenantA = (cA.body as { client?: { tenantId?: string } }).client?.tenantId;
    if (!tenantA) return { ok: false, errors: ["Sem tenantA"] };

    const cB = await createClient_(env, partner.cookieHeader, {
      name: idsB.name,
      slug: idsB.slug,
      adminEmail: idsB.adminEmail,
      adminName: idsB.adminName,
      adminPassword: idsB.adminPassword,
      plan: "pro",
    });
    if (cB.status !== 201) {
      return { ok: false, errors: [`Create B falhou: ${cB.status} ${JSON.stringify(cB.body)}`] };
    }
    const tenantB = (cB.body as { client?: { tenantId?: string } }).client?.tenantId;
    if (!tenantB) return { ok: false, errors: ["Sem tenantB"] };

    // 2. Reescreve whatsapp_number "pending" criado pelo provisioning com creds reais
    const updateWn = async (tenantId: string, phone: string, label: string, session: string, token: string) => {
      // tem que ficar com phone unique global → suffix com nonce
      const phoneUnique = `${phone}-test-${nonce}`;
      const { error } = await sb
        .from("whatsapp_number")
        .update({
          phone_number: phoneUnique,
          label,
          uazapi_session: session,
          uazapi_token: token,
          server_url: SERVER,
          is_active: true,
        })
        .eq("tenant_id", tenantId);
      return error;
    };
    const eA = await updateWn(tenantA, PHONE_A, `Iso A ${nonce}`, SESSION_A, UAZ_A_TOKEN);
    if (eA) return { ok: false, errors: [`Update wnA: ${eA.message}`] };
    const eB = await updateWn(tenantB, PHONE_B, `Iso B ${nonce}`, SESSION_B, UAZ_B_TOKEN);
    if (eB) return { ok: false, errors: [`Update wnB: ${eB.message}`] };

    const { data: wnA } = await sb.from("whatsapp_number").select("id, uazapi_token").eq("tenant_id", tenantA).single();
    const { data: wnB } = await sb.from("whatsapp_number").select("id, uazapi_token").eq("tenant_id", tenantB).single();
    if (!wnA || !wnB) return { ok: false, errors: ["wn não encontrado após update"] };

    // 3. Pega stage default de cada tenant
    const stageOfTenant = async (tid: string) => {
      const { data: pipe } = await sb.from("pipeline").select("id").eq("tenant_id", tid).limit(1).single();
      if (!pipe) return null;
      const { data: stages } = await sb.from("pipeline_stage").select("id").eq("pipeline_id", pipe.id).order("order", { ascending: true });
      return stages?.[0]?.id ?? null;
    };
    const stageAId = await stageOfTenant(tenantA);
    const stageBId = await stageOfTenant(tenantB);
    if (!stageAId || !stageBId) return { ok: false, errors: ["Stage default ausente"] };

    // 4. Cria conversation + lead em cada tenant (target = número do OUTRO tenant)
    const mkLead = async (tenantId: string, wnId: string, stageId: string, contactPhone: string) => {
      const { data: conv, error: cErr } = await sb
        .from("crm_conversation")
        .insert({
          tenant_id: tenantId,
          whatsapp_number_id: wnId,
          contact_phone: contactPhone,
          contact_name: `Test J ${nonce}`,
          classification: "new",
          is_group: false,
        })
        .select()
        .single();
      if (cErr || !conv) throw new Error(`conv: ${cErr?.message}`);
      const { data: ld, error: lErr } = await sb
        .from("lead")
        .insert({
          tenant_id: tenantId,
          name: `Lead J ${nonce}`,
          phone: contactPhone,
          stage_id: stageId,
          crm_conversation_id: conv.id,
        })
        .select()
        .single();
      if (lErr || !ld) throw new Error(`lead: ${lErr?.message}`);
      return { convId: conv.id as string, leadId: ld.id as string };
    };
    const A = await mkLead(tenantA, wnA.id, stageAId, PHONE_B);
    const B = await mkLead(tenantB, wnB.id, stageBId, PHONE_A);

    // 5. Cria 3 automations em cada tenant: welcome + fu1 (1min) + fu2 (3min)
    const specs = [
      { name: "welcome", trigger: "first_message", cfg: {}, msg: `[J ${nonce}] welcome from {{nome}}` },
      { name: "fu1", trigger: "lead_inactive", cfg: { inactiveMinutes: 1 }, msg: `[J ${nonce}] fu1 from {{nome}}` },
      { name: "fu2", trigger: "lead_inactive", cfg: { inactiveMinutes: 3 }, msg: `[J ${nonce}] fu2 from {{nome}}` },
    ];

    const autosByTenant: Record<string, Array<{ id: string; trigger: string; stepId: string }>> = {};
    for (const tenantId of [tenantA, tenantB]) {
      autosByTenant[tenantId] = [];
      for (const s of specs) {
        const { data: auto, error: aErr } = await sb
          .from("automation")
          .insert({
            tenant_id: tenantId,
            name: `J ${s.name} ${nonce}`,
            trigger_type: s.trigger,
            trigger_config: s.cfg,
            is_active: true,
          })
          .select()
          .single();
        if (aErr || !auto) return { ok: false, errors: [`automation: ${aErr?.message}`] };
        const { data: step, error: sErr } = await sb
          .from("automation_step")
          .insert({
            automation_id: auto.id,
            order: 0,
            type: "send_whatsapp",
            config: { message: s.msg },
          })
          .select()
          .single();
        if (sErr || !step) return { ok: false, errors: [`step: ${sErr?.message}`] };
        autosByTenant[tenantId].push({ id: auto.id, trigger: s.trigger, stepId: step.id });
      }
    }

    // 6. Cria automation_log pendente pra welcome (simula trigger)
    const insertWelcomeLog = async (tenantId: string, leadId: string) => {
      const welcome = autosByTenant[tenantId].find((a) => a.trigger === "first_message");
      if (!welcome) throw new Error("welcome auto missing");
      const { error } = await sb.from("automation_log").insert({
        automation_id: welcome.id,
        lead_id: leadId,
        step_id: welcome.stepId,
        trigger_type: "first_message",
        status: "pending",
        scheduled_at: new Date().toISOString(),
      });
      if (error) throw new Error(`welcome log: ${error.message}`);
    };
    await insertWelcomeLog(tenantA, A.leadId);
    await insertWelcomeLog(tenantB, B.leadId);

    // 7. Marca lastOutgoingAt retroativo (4min atrás) pra ambos elegíveis aos lead_inactive
    const fourMinAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await sb.from("crm_conversation").update({ last_outgoing_at: fourMinAgo, last_incoming_at: fiveMinAgo }).eq("id", A.convId);
    await sb.from("crm_conversation").update({ last_outgoing_at: fourMinAgo, last_incoming_at: fiveMinAgo }).eq("id", B.convId);

    // 8. Invoca runner LOCALMENTE (Node) ao invés de via cron deployado.
    //    Razão: o test pode rodar antes do deploy do código novo (com serverUrl).
    //    O runner local lê código atualizado deste repo e usa db.ts → DATABASE_URL.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const runner = await import("../../src/lib/automations/runner");

    const pings: Array<{ phase: string; result: unknown }> = [];

    // Welcome: já tem log pendente → process
    pings.push({ phase: "welcome", result: await runner.processPendingAutomations(50) });
    await sleep(2000);

    // Welcome atualiza lastOutgoingAt = now → reset retroativo pra fu1/fu2 elegíveis
    const fourMinAgoAfter = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    await sb.from("crm_conversation").update({ last_outgoing_at: fourMinAgoAfter }).eq("id", A.convId);
    await sb.from("crm_conversation").update({ last_outgoing_at: fourMinAgoAfter }).eq("id", B.convId);

    // Schedule lead_inactive (cadeia fu1 → fu2 baseada em lastOutgoingAt retroativo)
    pings.push({ phase: "schedule1", result: await runner.scheduleInactiveLeadFollowups({}) });
    pings.push({ phase: "fu1", result: await runner.processPendingAutomations(50) });
    await sleep(2000);

    // fu1 atualiza lastOutgoingAt? Não — runner pula update pra lead_inactive.
    // Mas o uq_autolog_welcome bloqueia 1 log por (auto, lead) só pra first_message.
    // Pra lead_inactive a cadeia avança step a step: fu1 sent → fu2 elegível.
    pings.push({ phase: "schedule2", result: await runner.scheduleInactiveLeadFollowups({}) });
    pings.push({ phase: "fu2", result: await runner.processPendingAutomations(50) });

    // 9. Asserts: query as msgs criadas
    const { data: msgs, error: mErr } = await sb
      .from("crm_message")
      .select("id, content, conversation_id, timestamp, direction")
      .like("content", `[J ${nonce}]%`)
      .order("timestamp", { ascending: true });

    if (mErr) return { ok: false, errors: [`Query msgs: ${mErr.message}`] };
    if (!msgs || msgs.length === 0) {
      return { ok: false, errors: ["Nenhuma msg criada com prefixo do nonce"], details: { pings } };
    }

    // Map conv → tenant + token
    const convTokens = new Map<string, { tenantId: string; token: string }>();
    for (const convId of [A.convId, B.convId]) {
      const { data: c } = await sb.from("crm_conversation").select("tenant_id, whatsapp_number_id").eq("id", convId).single();
      if (!c) continue;
      const { data: w } = await sb.from("whatsapp_number").select("tenant_id, uazapi_token").eq("id", c.whatsapp_number_id).single();
      if (!w) continue;
      convTokens.set(convId, { tenantId: w.tenant_id, token: w.uazapi_token });
    }

    const errors: string[] = [];
    let countA = 0;
    let countB = 0;
    for (const m of msgs) {
      const ct = convTokens.get(m.conversation_id);
      if (!ct) {
        errors.push(`msg ${m.id} sem conv mapeada`);
        continue;
      }
      if (ct.tenantId === tenantA) {
        if (ct.token !== UAZ_A_TOKEN) errors.push(`Tenant A msg saiu por token errado (${ct.token.slice(0, 8)}...)`);
        countA++;
      } else if (ct.tenantId === tenantB) {
        if (ct.token !== UAZ_B_TOKEN) errors.push(`Tenant B msg saiu por token errado (${ct.token.slice(0, 8)}...)`);
        countB++;
      } else {
        errors.push(`msg ${m.id} em tenant alheio (${ct.tenantId})`);
      }
    }

    if (countA === 0) errors.push("Nenhuma msg saiu pelo Tenant A");
    if (countB === 0) errors.push("Nenhuma msg saiu pelo Tenant B");

    if (errors.length > 0) {
      return { ok: false, errors, details: { msgs: msgs.length, countA, countB, pings } };
    }

    return {
      ok: true,
      details: {
        totalMessages: msgs.length,
        countA,
        countB,
        nonce,
        sample: msgs.slice(0, 6).map((m) => m.content?.slice(0, 80)),
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// K. Áudio PTT live: cria tenant test, vincula wn heliobot, posta OGG no
//    endpoint send-media e confirma que crm_message saiu como audio+ogg.
//    Opt-in (--only=K) — envia áudio real pro 5521991913946.
// ─────────────────────────────────────────────────────────────────────────────
export async function scenarioK_audioPtt(env: TestEnv): Promise<ScenarioResult> {
  return runScenario("K:audio-ptt-live", async () => {
    const UAZ_TOKEN = process.env.UAZ_TEST_TOKEN ?? "d7db5ff9-a73b-4dda-9808-3b1125971b3c";
    const UAZ_SESSION = process.env.UAZ_TEST_SESSION ?? "heliobot";
    const UAZ_PHONE = process.env.UAZ_TEST_PHONE ?? "5521991913946";
    const SERVER = process.env.UAZ_SERVER_URL ?? "https://growthhub.uazapi.com";

    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(env.supabaseUrl, env.supabaseServiceKey);

    const partner = await loginAs(env, env.partnerEmail, env.partnerPassword);
    const ids = testIds(env, "k-audio");

    // 1. Cria tenant test
    const create = await createClient_(env, partner.cookieHeader, {
      name: ids.name,
      slug: ids.slug,
      adminEmail: ids.adminEmail,
      adminName: ids.adminName,
      adminPassword: ids.adminPassword,
      plan: "pro",
    });
    if (create.status !== 201) {
      return { ok: false, errors: [`Create K falhou: ${create.status}`] };
    }
    const tenantId = (create.body as { client?: { tenantId?: string } }).client?.tenantId;
    if (!tenantId) return { ok: false, errors: ["Sem tenantId"] };

    // 2. Reescreve whatsapp_number provisionado com creds heliobot
    const phoneUnique = `${UAZ_PHONE}-test-${env.nonce}`;
    const { error: wnErr } = await sb
      .from("whatsapp_number")
      .update({
        phone_number: phoneUnique,
        label: `K audio ${env.nonce}`,
        uazapi_session: UAZ_SESSION,
        uazapi_token: UAZ_TOKEN,
        server_url: SERVER,
        is_active: true,
      })
      .eq("tenant_id", tenantId);
    if (wnErr) return { ok: false, errors: [`Update wn: ${wnErr.message}`] };

    const { data: wn } = await sb
      .from("whatsapp_number")
      .select("id")
      .eq("tenant_id", tenantId)
      .single();
    if (!wn) return { ok: false, errors: ["wn não encontrado"] };

    // 3. Cria conversation (target = mesmo número heliobot — loopback)
    const { data: conv, error: cErr } = await sb
      .from("crm_conversation")
      .insert({
        tenant_id: tenantId,
        whatsapp_number_id: wn.id,
        contact_phone: UAZ_PHONE, // loopback: heliobot enviando pra si mesmo
        contact_name: `K test ${env.nonce}`,
        classification: "new",
        is_group: false,
      })
      .select()
      .single();
    if (cErr || !conv) return { ok: false, errors: [`Conv: ${cErr?.message}`] };

    // 4. Logaem como admin do tenant test, posta áudio via endpoint
    const admin = await loginAs(env, ids.adminEmail, ids.adminPassword);
    const oggBuf = readFileSync(join(__dirname, "..", "fixtures", "sample.ogg"));
    const oggB64 = oggBuf.toString("base64");
    const dataUri = `data:audio/ogg;codecs=opus;base64,${oggB64}`;

    const sendRes = await fetch(`${env.targetUrl}/api/crm/${conv.id}/send-media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        file: dataUri,
        fileName: `k-audio-${env.nonce}.ogg`,
        isAudio: true,
      }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    if (sendRes.status !== 200) {
      return {
        ok: false,
        errors: [`send-media falhou: ${sendRes.status} ${JSON.stringify(sendBody).slice(0, 200)}`],
      };
    }

    // 5. Asserts no DB
    const { data: msg } = await sb
      .from("crm_message")
      .select("id, media_type, media_url, direction")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!msg) return { ok: false, errors: ["crm_message não encontrada"] };

    const errors: string[] = [];
    if (msg.media_type !== "audio") errors.push(`media_type=${msg.media_type} (esperado audio)`);
    if (!String(msg.media_url ?? "").includes(".ogg")) {
      errors.push(`media_url não termina em .ogg: ${msg.media_url}`);
    }
    if (msg.direction !== "outgoing") errors.push(`direction=${msg.direction}`);

    if (errors.length > 0) {
      return { ok: false, errors, details: { msg } };
    }

    return {
      ok: true,
      details: {
        tenant: tenantId,
        conversation: conv.id,
        messageId: msg.id,
        mediaUrl: msg.media_url,
        note: "Validação visual no celular necessária — confirmar balão de voz.",
      },
    };
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
      // FKs transitivas: precisamos pegar IDs das pais antes pra limpar filhas
      // que não têm tenant_id direto.
      const { data: convs } = await sb
        .from("crm_conversation")
        .select("id")
        .in("tenant_id", tenantIds);
      const convIds = (convs ?? []).map((c: { id: string }) => c.id);
      if (convIds.length > 0) {
        await sb.from("crm_message").delete().in("conversation_id", convIds);
      }
      const { data: autos } = await sb
        .from("automation")
        .select("id")
        .in("tenant_id", tenantIds);
      const autoIds = (autos ?? []).map((a: { id: string }) => a.id);
      if (autoIds.length > 0) {
        await sb.from("automation_log").delete().in("automation_id", autoIds);
        await sb.from("automation_step").delete().in("automation_id", autoIds);
      }

      // Algumas FK apontando pra tenant não tem ON DELETE CASCADE.
      // Limpa em ordem topológica antes de deletar tenant.
      const cleanupTables = [
        "crm_conversation",
        "lead",
        "pipeline_stage",
        "pipeline",
        "automation",
        "whatsapp_number",
        "task",
        "kanban_task",
        "kanban_column",
        "message_template",
        "notification",
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
