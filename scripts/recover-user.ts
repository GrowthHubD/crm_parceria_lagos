/**
 * scripts/recover-user.ts <email> <tenant-slug> [--reactivate] [--make-default]
 *
 * Recupera um usuário "sumido". Conserta os 2 cenários mais comuns:
 *   - ORFAO: cria row em user_tenant vinculando ao tenant-slug informado.
 *   - DESATIVADO: --reactivate seta isActive=true.
 *
 * Se passar --make-default, garante que apenas ESTE vínculo fica com
 * is_default=true (unsets os outros do mesmo user — respeita o unique index
 * uq_user_tenant_default em users.ts:98).
 *
 * Idempotente: usar `ON CONFLICT (user_id, tenant_id) DO NOTHING` evita erro
 * se já existir a row.
 *
 * Roda:
 *   $env:DATABASE_URL = "postgres://...prod..."
 *   npx tsx scripts/recover-user.ts alexandre@example.com lagos --reactivate --make-default
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const tenantSlug = args[1];
  const flags = new Set(args.slice(2));
  const reactivate = flags.has("--reactivate");
  const makeDefault = flags.has("--make-default");

  if (!email || !tenantSlug) {
    console.error("Uso: npx tsx scripts/recover-user.ts <email> <tenant-slug> [--reactivate] [--make-default]");
    process.exit(1);
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL no ambiente.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    console.log(`\n→ Recuperando ${email} → tenant ${tenantSlug}`);
    if (reactivate) console.log("  flag: --reactivate (vai setar isActive=true)");
    if (makeDefault) console.log("  flag: --make-default (vai fixar este como tenant default)");
    console.log("");

    const [u] = await sql<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM public."user"
      WHERE LOWER(email) = LOWER(${email}) LIMIT 1
    `;
    if (!u) {
      console.error(`✗ Email ${email} não existe em public.user. Não posso recuperar.`);
      console.error("   Conferir se o user existe em Supabase Auth e espelhar em public.user primeiro.");
      process.exit(1);
    }

    const [t] = await sql<Array<{ id: string; name: string; status: string }>>`
      SELECT id, name, status FROM public.tenant
      WHERE slug = ${tenantSlug} LIMIT 1
    `;
    if (!t) {
      console.error(`✗ Tenant slug "${tenantSlug}" não existe.`);
      const candidates = await sql<Array<{ slug: string; name: string }>>`
        SELECT slug, name FROM public.tenant ORDER BY slug LIMIT 20
      `;
      console.error("\nTenants disponíveis:");
      for (const c of candidates) console.error(`  - ${c.slug} (${c.name})`);
      process.exit(1);
    }
    if (t.status !== "active") {
      console.warn(`⚠ Tenant ${tenantSlug} tem status=${t.status} (não "active"). Vinculando mesmo assim.`);
    }

    await sql.begin(async (tx) => {
      const before = await tx<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM public.user_tenant
        WHERE user_id = ${u.id} AND tenant_id = ${t.id}
      `;

      // Inserção idempotente.
      await tx`
        INSERT INTO public.user_tenant (user_id, tenant_id, role, is_default)
        VALUES (${u.id}, ${t.id}, 'admin', ${makeDefault})
        ON CONFLICT (user_id, tenant_id) DO NOTHING
      `;

      const created = Number(before[0].count) === 0;
      console.log(
        created
          ? `✓ Vínculo CRIADO: ${email} → ${tenantSlug} (role=admin, isDefault=${makeDefault})`
          : `· Vínculo já existia: ${email} → ${tenantSlug} (sem mudança via INSERT)`
      );

      if (makeDefault) {
        // Garante unique: zera default dos OUTROS bindings, depois marca este.
        // Necessário porque o índice uq_user_tenant_default (users.ts:98) só
        // permite 1 row com is_default=true por user.
        await tx`
          UPDATE public.user_tenant
          SET is_default = false
          WHERE user_id = ${u.id} AND tenant_id <> ${t.id}
        `;
        await tx`
          UPDATE public.user_tenant
          SET is_default = true
          WHERE user_id = ${u.id} AND tenant_id = ${t.id}
        `;
        console.log(`✓ is_default fixado em ${tenantSlug} (outros bindings desmarcados)`);
      }

      if (reactivate && !u.isActive) {
        await tx`
          UPDATE public."user"
          SET "isActive" = true, "updatedAt" = NOW()
          WHERE id = ${u.id}
        `;
        console.log(`✓ user.isActive setado para true`);
      } else if (reactivate) {
        console.log(`· user.isActive já era true (skip)`);
      }
    });

    console.log("\n═══ ESTADO PÓS-RECUPERAÇÃO ═══");
    const bindings = await sql<
      Array<{ tenantSlug: string; role: string; isDefault: boolean }>
    >`
      SELECT t.slug AS "tenantSlug", ut.role, ut.is_default AS "isDefault"
      FROM public.user_tenant ut
      JOIN public.tenant t ON t.id = ut.tenant_id
      WHERE ut.user_id = ${u.id}
      ORDER BY ut.created_at ASC
    `;
    for (const b of bindings) {
      const def = b.isDefault ? " [default]" : "";
      console.log(`  ${b.tenantSlug} — role=${b.role}${def}`);
    }

    const [reread] = await sql<Array<{ isActive: boolean }>>`
      SELECT "isActive" FROM public."user" WHERE id = ${u.id}
    `;
    console.log(`  isActive: ${reread.isActive}`);

    console.log("\n→ Próximo passo: peça pro usuário fazer LOGOUT e LOGIN novamente.");
    console.log("  Há um cache KV de tenant context (TTL 30s) que precisa expirar.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
