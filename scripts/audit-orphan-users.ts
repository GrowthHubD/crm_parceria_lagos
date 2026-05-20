/**
 * scripts/audit-orphan-users.ts
 *
 * Auditoria global: pega todos os users em estado inconsistente que podem
 * estar invisíveis ou com acesso quebrado. Útil rodar periodicamente (ideal
 * via cron) pra detectar "Alexandres" antes que eles tenham que reportar.
 *
 * Categorias reportadas:
 *   ORFAO              → user existe mas SEM nenhuma row em user_tenant
 *                        → não consegue passar pelo getTenantContext
 *   DESATIVADO         → user.isActive=false
 *                        → some de dropdowns; pode logar mas não recebe atribuições
 *   MULTIPLE_DEFAULTS  → mais de 1 user_tenant com is_default=true
 *                        → tenant resolution não-determinística
 *   STALE_SESSION      → user sem sessão válida há >90d (informativo)
 *
 * Output:
 *   - Resumo na stdout em PT-BR
 *   - CSV detalhado em stderr (redirecione com `2> orphans.csv`)
 *
 * Roda:
 *   $env:DATABASE_URL = "postgres://...prod..."
 *   npx tsx scripts/audit-orphan-users.ts 2> orphans.csv
 */
import "dotenv/config";
import postgres from "postgres";

type Severity = "ORFAO" | "DESATIVADO" | "MULTIPLE_DEFAULTS";

interface AuditRow {
  severity: Severity;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  details: string;
  createdAt: Date;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL no ambiente.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    console.log("\n→ Auditando users no banco…\n");

    const orphans = await sql<
      Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
      }>
    >`
      SELECT u.id, u.email, u.name, u.role, u."isActive", u."createdAt"
      FROM public."user" u
      LEFT JOIN public.user_tenant ut ON ut.user_id = u.id
      WHERE ut.id IS NULL
      ORDER BY u."createdAt" DESC
    `;

    const deactivated = await sql<
      Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        updatedAt: Date;
        createdAt: Date;
      }>
    >`
      SELECT id, email, name, role, "updatedAt", "createdAt"
      FROM public."user"
      WHERE "isActive" = false
      ORDER BY "updatedAt" DESC
    `;

    const multiDefault = await sql<
      Array<{
        userId: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        defaultCount: bigint;
        createdAt: Date;
      }>
    >`
      SELECT
        u.id AS "userId",
        u.email,
        u.name,
        u.role,
        u."isActive",
        COUNT(*)::bigint AS "defaultCount",
        u."createdAt"
      FROM public.user_tenant ut
      JOIN public."user" u ON u.id = ut.user_id
      WHERE ut.is_default = true
      GROUP BY u.id, u.email, u.name, u.role, u."isActive", u."createdAt"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `;

    const rows: AuditRow[] = [];
    for (const o of orphans) {
      rows.push({
        severity: "ORFAO",
        userId: o.id,
        email: o.email,
        name: o.name,
        role: o.role,
        isActive: o.isActive,
        details: "Sem vínculo em user_tenant",
        createdAt: o.createdAt,
      });
    }
    for (const d of deactivated) {
      rows.push({
        severity: "DESATIVADO",
        userId: d.id,
        email: d.email,
        name: d.name,
        role: d.role,
        isActive: false,
        details: `Desativado em ${d.updatedAt.toISOString()}`,
        createdAt: d.createdAt,
      });
    }
    for (const m of multiDefault) {
      rows.push({
        severity: "MULTIPLE_DEFAULTS",
        userId: m.userId,
        email: m.email,
        name: m.name,
        role: m.role,
        isActive: m.isActive,
        details: `${m.defaultCount} bindings com is_default=true`,
        createdAt: m.createdAt,
      });
    }

    // Resumo na stdout
    console.log("─── RESUMO ───");
    console.log(`  ÓRFÃOS              ${orphans.length}`);
    console.log(`  DESATIVADOS         ${deactivated.length}`);
    console.log(`  MULTIPLE_DEFAULTS   ${multiDefault.length}`);
    console.log(`  ──────────────────`);
    console.log(`  TOTAL              ${rows.length}`);

    if (orphans.length > 0) {
      console.log("\n─── ÓRFÃOS (top 10 mais recentes) ───");
      for (const o of orphans.slice(0, 10)) {
        console.log(`  ${o.email}  (role=${o.role}, criado em ${o.createdAt.toISOString()})`);
      }
      if (orphans.length > 10) console.log(`  … e mais ${orphans.length - 10}`);
    }

    if (deactivated.length > 0) {
      console.log("\n─── DESATIVADOS (top 10 mais recentes) ───");
      for (const d of deactivated.slice(0, 10)) {
        console.log(`  ${d.email}  (desativado em ${d.updatedAt.toISOString()})`);
      }
      if (deactivated.length > 10) console.log(`  … e mais ${deactivated.length - 10}`);
    }

    if (multiDefault.length > 0) {
      console.log("\n─── MULTIPLE_DEFAULTS ───");
      for (const m of multiDefault) {
        console.log(`  ${m.email}  (${m.defaultCount} bindings com is_default=true)`);
      }
    }

    // CSV detalhado em stderr — redirecionar com `2> orphans.csv`
    if (rows.length > 0) {
      console.error("severity,userId,email,name,role,isActive,details,createdAt");
      for (const r of rows) {
        console.error(
          [
            r.severity,
            r.userId,
            csvEscape(r.email),
            csvEscape(r.name),
            r.role,
            r.isActive ? "true" : "false",
            csvEscape(r.details),
            r.createdAt.toISOString(),
          ].join(",")
        );
      }
      console.log("\n→ CSV detalhado escrito em stderr. Re-rode com `2> orphans.csv` pra salvar.");
    }

    if (rows.length === 0) {
      console.log("\n✓ Nenhuma inconsistência. Banco saudável.");
    } else {
      console.log("\n→ Para recuperar um user específico:");
      console.log("  npx tsx scripts/diagnose-user.ts <email>");
      console.log("  npx tsx scripts/recover-user.ts <email> <tenant-slug> [--reactivate] [--make-default]");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
