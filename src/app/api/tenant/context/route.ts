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

  // 3) Lookup tenant binding — primeiro tenta o default, senão pega QUALQUER vínculo
  // (self-heal pra users criados via partner panel sem is_default=true)
  let { data: utRowRaw, error: utErr } = await admin
    .from("user_tenant")
    .select("role, is_default, tenant:tenant_id(id, slug, is_platform_owner)")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (utErr) {
    return NextResponse.json(
      { error: "TENANT_LOOKUP_ERROR", debugMessage: utErr.message },
      { status: 500 }
    );
  }

  if (!utRowRaw) {
    // Fallback: qualquer user_tenant pra esse user (mais recente primeiro)
    const { data: anyRows, error: anyErr } = await admin
      .from("user_tenant")
      .select("id, role, tenant:tenant_id(id, slug, is_platform_owner)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (anyErr) {
      return NextResponse.json(
        { error: "TENANT_LOOKUP_ERROR", debugMessage: anyErr.message },
        { status: 500 }
      );
    }

    const first = anyRows?.[0] as
      | { id: string; role: string; tenant: { id: string; slug: string; is_platform_owner: boolean } | null }
      | undefined;

    if (!first) {
      return NextResponse.json({ error: "NO_TENANT_ACCESS" }, { status: 403 });
    }

    // Promove pra default (idempotente — próximas requests pegam o caminho rápido)
    await admin.from("user_tenant").update({ is_default: true }).eq("id", first.id);
    utRowRaw = { role: first.role, is_default: true, tenant: first.tenant };
  }

  const utRow = utRowRaw as {
    role: string;
    is_default: boolean;
    tenant: { id: string; slug: string; is_platform_owner: boolean } | null;
  };

  if (!utRow.tenant) {
    return NextResponse.json({ error: "NO_TENANT_ACCESS" }, { status: 403 });
  }

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
