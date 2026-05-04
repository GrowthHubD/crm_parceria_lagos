/**
 * /api/tenant/context — gate do dashboard. Retorna tenant + user + módulos
 * permitidos.
 *
 * Auth: cliente SSR (lê cookie do user, valida JWT). Bypass de RLS pra os
 * lookups subsequentes via cliente admin (service_role) — seguro pq o user
 * já foi autenticado e os campos retornados são apenas o que o gate precisa.
 *
 * Por que não Drizzle: postgres-js abre socket TCP que é instável em
 * cold-start no CF Worker (Worker exception 1101 intermitente). PostgREST
 * via HTTPS não tem esse problema.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserModules } from "@/lib/permissions";
import type { UserRole } from "@/types";

export async function GET(_request: NextRequest) {
  // 1) Auth via cliente SSR (usa o JWT do cookie do user)
  let userId: string;
  let authEmail: string | null = null;
  let authName: string | null = null;
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    userId = data.user.id;
    authEmail = data.user.email ?? null;
    authName = (data.user.user_metadata?.name as string | undefined) ?? null;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "AUTH_ERROR", debugMessage: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  // 2) Lookups subsequentes via service_role (bypass RLS — o user já tá autenticado)
  const admin = getSupabaseAdmin();

  let { data: userRowRaw, error: userErr } = await admin
    .from("user")
    .select("id, name, image")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    return NextResponse.json(
      { error: "USER_LOOKUP_ERROR", debugMessage: userErr.message },
      { status: 500 }
    );
  }

  // Self-heal: user autenticado em Supabase Auth mas sem linha em public.user
  // (provisioning antigo silenciava esse erro). Cria automaticamente.
  if (!userRowRaw && authEmail) {
    const { data: created, error: createErr } = await admin
      .from("user")
      .insert({
        id: userId,
        name: authName ?? authEmail,
        email: authEmail,
        emailVerified: true,
        role: "admin",
        isActive: true,
      })
      .select("id, name, image")
      .single();
    if (createErr) {
      return NextResponse.json(
        { error: "USER_BACKFILL_FAILED", debugMessage: createErr.message },
        { status: 500 }
      );
    }
    userRowRaw = created;
  }
  if (!userRowRaw) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  const userRow = userRowRaw as { id: string; name: string; image: string | null };

  // 3) Lookup tenant binding — pega TODOS os vínculos e escolhe o melhor
  // (default primeiro, depois mais recente). Tolera duplicatas de is_default=true
  // que aconteciam em provisioning antigo rodado múltiplas vezes pro mesmo user.
  const { data: utRows, error: utErr } = await admin
    .from("user_tenant")
    .select("id, role, is_default, created_at, tenant:tenant_id(id, slug, is_platform_owner)")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (utErr) {
    return NextResponse.json(
      { error: "TENANT_LOOKUP_ERROR", debugMessage: utErr.message },
      { status: 500 }
    );
  }

  type UtRow = {
    id: string;
    role: string;
    is_default: boolean;
    created_at: string;
    tenant: { id: string; slug: string; is_platform_owner: boolean } | null;
  };

  const rows = (utRows ?? []) as UtRow[];
  const chosen = rows.find((r) => r.tenant !== null);

  if (!chosen || !chosen.tenant) {
    return NextResponse.json({ error: "NO_TENANT_ACCESS" }, { status: 403 });
  }

  // Self-heal: se houver múltiplos is_default=true OU o escolhido não é default,
  // normaliza pra ter exatamente 1 default (o escolhido) — evita o erro
  // "multiple rows returned" em queries .maybeSingle() futuras.
  const defaults = rows.filter((r) => r.is_default);
  const needsNormalize = defaults.length !== 1 || defaults[0]?.id !== chosen.id;
  if (needsNormalize) {
    await admin
      .from("user_tenant")
      .update({ is_default: false })
      .eq("user_id", userId);
    await admin
      .from("user_tenant")
      .update({ is_default: true })
      .eq("id", chosen.id);
  }

  const utRow = {
    role: chosen.role,
    tenant: chosen.tenant,
  };

  const t = utRow.tenant;
  const role = utRow.role as UserRole;

  // 4) Resolver módulos (superadmin/partner retornam imediato — sem DB)
  let modules;
  try {
    modules = await getUserModules(userId, role, {
      userId,
      tenantId: t.id,
      tenantSlug: t.slug,
      isPlatformOwner: t.is_platform_owner,
      role: utRow.role,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "MODULES_ERROR", debugMessage: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tenantId: t.id,
    tenantSlug: t.slug,
    isPlatformOwner: t.is_platform_owner,
    role: utRow.role,
    modules,
    userName: userRow.name,
    userImage: userRow.image ?? null,
  });
}
