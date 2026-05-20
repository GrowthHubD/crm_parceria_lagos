/**
 * scripts/diagnose-user.ts <email>
 *
 * Diagnóstico read-only do estado de um usuário. Útil quando alguém reporta
 * "minha conta sumiu" / "não consigo acessar o CRM" — investigamos sem mexer
 * em nada antes de decidir o fix.
 *
 * Roda local apontando pro DATABASE_URL de produção:
 *   $env:DATABASE_URL = "postgres://...prod..."   (PowerShell)
 *   npx tsx scripts/diagnose-user.ts alexandre@example.com
 *
 * Status possíveis:
 *   ORFAO              → user existe mas sem nenhuma row em user_tenant
 *                        (getTenantContext joga NO_TENANT_ACCESS → 500)
 *   DESATIVADO         → user.isActive = false (some de dropdowns mas pode logar)
 *   MULTIPLE_DEFAULTS  → mais de 1 row em user_tenant com is_default=true
 *                        (getTenantContext pode pegar o tenant errado)
 *   NAO_ENCONTRADO     → email não bate com nenhuma row em public.user
 *   OK                 → tudo certo, problema é em outro lugar
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npx tsx scripts/diagnose-user.ts <email>");
    process.exit(1);
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL no ambiente.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    console.log(`\n→ Diagnosticando ${email}\n`);

    const [u] = await sql<
      Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT id, name, email, role, "isActive", "createdAt", "updatedAt"
      FROM public."user"
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;

    if (!u) {
      console.log("Status: NAO_ENCONTRADO");
      console.log(`✗ Nenhum user com email "${email}" em public.user.`);
      console.log("\nProvável: usuário nunca foi criado, ou email tem typo.");
      console.log("Conferir Supabase Auth: o user pode existir lá mas não estar espelhado em public.user.");
      return;
    }

    console.log("─── public.user ───");
    console.log(`  id:        ${u.id}`);
    console.log(`  nome:      ${u.name}`);
    console.log(`  role:      ${u.role}`);
    console.log(`  isActive:  ${u.isActive}`);
    console.log(`  criado em: ${u.createdAt.toISOString()}`);
    console.log(`  atualizado: ${u.updatedAt.toISOString()}`);

    const bindings = await sql<
      Array<{
        bindingId: string;
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        isPlatformOwner: boolean;
        isPartner: boolean;
        role: string;
        isDefault: boolean;
        createdAt: Date;
      }>
    >`
      SELECT
        ut.id AS "bindingId",
        ut.tenant_id AS "tenantId",
        t.name AS "tenantName",
        t.slug AS "tenantSlug",
        t.is_platform_owner AS "isPlatformOwner",
        t.is_partner AS "isPartner",
        ut.role,
        ut.is_default AS "isDefault",
        ut.created_at AS "createdAt"
      FROM public.user_tenant ut
      JOIN public.tenant t ON t.id = ut.tenant_id
      WHERE ut.user_id = ${u.id}
      ORDER BY ut.created_at ASC
    `;

    console.log(`\n─── user_tenant (${bindings.length} vínculo(s)) ───`);
    if (bindings.length === 0) {
      console.log("  (nenhum)");
    } else {
      for (const b of bindings) {
        const tags: string[] = [];
        if (b.isDefault) tags.push("default");
        if (b.isPlatformOwner) tags.push("platform_owner");
        if (b.isPartner) tags.push("partner");
        const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
        console.log(`  ${b.tenantSlug} (${b.tenantName}) — role=${b.role}${tagStr}`);
      }
    }

    const sessions = await sql<
      Array<{ id: string; expiresAt: Date; userAgent: string | null; createdAt: Date }>
    >`
      SELECT id, "expiresAt", "userAgent", "createdAt"
      FROM public.session
      WHERE "userId" = ${u.id} AND "expiresAt" > NOW()
      ORDER BY "createdAt" DESC
      LIMIT 3
    `;

    console.log(`\n─── Sessões ativas (${sessions.length}) ───`);
    if (sessions.length === 0) {
      console.log("  (nenhuma sessão válida)");
    } else {
      for (const s of sessions) {
        const ua = (s.userAgent ?? "").slice(0, 60);
        console.log(`  ${s.createdAt.toISOString()} → expira em ${s.expiresAt.toISOString()}`);
        if (ua) console.log(`    UA: ${ua}`);
      }
    }

    const perms = await sql<Array<{ module: string; canView: boolean; canEdit: boolean; canDelete: boolean }>>`
      SELECT module, can_view AS "canView", can_edit AS "canEdit", can_delete AS "canDelete"
      FROM public.module_permission
      WHERE user_id = ${u.id}
      ORDER BY module
    `;

    console.log(`\n─── module_permission (${perms.length} override(s)) ───`);
    if (perms.length === 0) {
      console.log("  (nenhum override — usa permissões padrão do role)");
    } else {
      for (const p of perms) {
        const flags: string[] = [];
        if (p.canView) flags.push("view");
        if (p.canEdit) flags.push("edit");
        if (p.canDelete) flags.push("delete");
        console.log(`  ${p.module}: ${flags.length > 0 ? flags.join(",") : "(nada)"}`);
      }
    }

    const defaultCount = bindings.filter((b) => b.isDefault).length;

    console.log("\n═══ DIAGNÓSTICO ═══");
    if (bindings.length === 0) {
      console.log("Status: ORFAO");
      console.log("");
      console.log("Causa: user existe em public.user mas SEM vínculo em user_tenant.");
      console.log("Efeito: getTenantContext() (src/lib/tenant.ts:255-258) joga NO_TENANT_ACCESS");
      console.log("        em toda request autenticada → 500/redirect, acesso negado.");
      console.log("");
      console.log("Fix:");
      console.log(`  npx tsx scripts/recover-user.ts ${email} <tenant-slug> --make-default`);
      console.log("  (precisa saber o slug do tenant onde ele opera — pergunte ao usuário)");
    } else if (!u.isActive) {
      console.log("Status: DESATIVADO");
      console.log("");
      console.log("Causa: user.isActive = false.");
      console.log("Efeito: some de dropdowns de \"responsável\" (queries filtram WHERE isActive = true),");
      console.log("        mas pode logar normalmente — só não recebe atribuições.");
      console.log("");
      console.log("Fix:");
      console.log(`  npx tsx scripts/recover-user.ts ${email} ${bindings[0].tenantSlug} --reactivate`);
    } else if (defaultCount > 1) {
      console.log("Status: MULTIPLE_DEFAULTS");
      console.log("");
      console.log(`Causa: ${defaultCount} rows em user_tenant com is_default=true.`);
      console.log("Efeito: getTenantContext pode escolher o tenant errado a cada request.");
      console.log("        Estado inconsistente — uniqueIndex em users.ts:98 só foi adicionado depois.");
      console.log("");
      console.log("Fix manual no Drizzle Studio: deixar apenas 1 binding com is_default=true.");
    } else {
      console.log("Status: OK");
      console.log("");
      console.log("User parece estar saudável no banco.");
      console.log("Se mesmo assim está reportando que \"sumiu do CRM\", investigar:");
      console.log("  - Está logando com email correto?");
      console.log("  - Cache KV de tenant pode estar stale (TTL 30s) — peça pra ele relogar.");
      console.log("  - Role atual permite acesso ao CRM? (checkPermission em src/lib/permissions.ts)");
      console.log("  - Há algum override de tenant cookie ativo? (src/lib/tenant-override.ts)");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
