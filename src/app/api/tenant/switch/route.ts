/**
 * /api/tenant/switch — troca tenant ativo do user via cookie httpOnly assinado.
 *
 * POST   { tenantId } → valida permissão + grava cookie gh-tenant-override
 * DELETE              → limpa o cookie (volta pro tenant default do user)
 *
 * Permissões:
 *  - superadmin → qualquer tenant existente
 *  - partner_admin → home tenant + tenants onde tenant.partner_id = home
 *  - demais → 403
 *
 * Trade-offs aceitos:
 * - Cookie HMAC válido até TTL (4h) mesmo se role for revogado entre o sign e o uso.
 *   Mitigação: TTL curto de 4h + verificação de userId.
 * - availableTenants em /tenant/context não é paginado — ok pra <500 tenants.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  OVERRIDE_COOKIE_NAME,
  OVERRIDE_TTL_SECONDS,
  signOverride,
} from "@/lib/tenant-override";

/**
 * Allowlist de origins permitidas em chamadas cross-site para a API de switch.
 * Bloqueia CSRF além do SameSite=lax do cookie de sessão.
 * - BETTER_AUTH_URL: produção/staging (env)
 * - Fallback hardcoded: domínio prod conhecido pra resiliência caso env falhe
 * - Origin AUSENTE é rejeitado: endpoint é só pra UI cliente, server-side calls
 *   sem Origin (curl, proxies) não devem conseguir bypass.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = new Set<string>();
  const envUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  if (envUrl) allowed.add(envUrl);
  allowed.add("https://crm.methodgrowthhub.com.br");
  return allowed.has(origin.replace(/\/$/, ""));
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  }

  let userId: string;
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    userId = data.user.id;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "AUTH_ERROR", debugMessage: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  let body: { tenantId?: string };
  try {
    body = (await request.json()) as { tenantId?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const tenantId = body?.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "MISSING_TENANT_ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1) Pegar roles elevados do user (qualquer tenant) — ordena por created_at
  // pra garantir determinismo quando user tem múltiplas rows com mesmo role.
  const { data: utRows, error: utErr } = await admin
    .from("user_tenant")
    .select("tenant_id, role, created_at, tenant:tenant_id(is_partner)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (utErr) {
    return NextResponse.json(
      { error: "USER_TENANT_LOOKUP_ERROR", debugMessage: utErr.message },
      { status: 500 }
    );
  }
  type UtRow = {
    tenant_id: string;
    role: string;
    created_at: string;
    tenant: { is_partner: boolean } | { is_partner: boolean }[] | null;
  };
  const rows = (utRows ?? []) as UtRow[];
  // Supabase pode retornar relação como array (1-N) ou objeto (1-1) dependendo do schema.
  const isPartnerTenant = (r: UtRow): boolean => {
    const t = r.tenant;
    if (!t) return false;
    if (Array.isArray(t)) return t[0]?.is_partner === true;
    return t.is_partner === true;
  };

  const isSuperadmin = rows.some((r) => r.role === "superadmin");
  // partner_admin: prefere row em tenant is_partner=true e mais antiga (rows já ordenadas).
  let partnerHomeTenantId: string | null = null;
  if (!isSuperadmin) {
    const candidate =
      rows.find((r) => r.role === "partner_admin" && isPartnerTenant(r)) ??
      rows.find((r) => r.role === "partner_admin");
    partnerHomeTenantId = candidate?.tenant_id ?? null;
  }

  // 2) Buscar tenant alvo
  const { data: targetRaw, error: tErr } = await admin
    .from("tenant")
    .select("id, slug, is_platform_owner, is_partner, partner_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (tErr) {
    return NextResponse.json(
      { error: "TENANT_LOOKUP_ERROR", debugMessage: tErr.message },
      { status: 500 }
    );
  }
  if (!targetRaw) {
    return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 404 });
  }
  const target = targetRaw as {
    id: string;
    slug: string;
    is_platform_owner: boolean;
    is_partner: boolean;
    partner_id: string | null;
  };

  // 3) Autorizar — APENAS superadmin e partner_admin podem trocar tenant.
  // Usuários normais (manager/operator/etc) NÃO podem fazer switch — getTenantContext()
  // ignoraria o cookie de qualquer forma, então emitir o cookie seria menor privilégio violado.
  let allowed = false;
  if (isSuperadmin) {
    allowed = true;
  } else if (partnerHomeTenantId) {
    allowed =
      target.id === partnerHomeTenantId || target.partner_id === partnerHomeTenantId;
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        debugMessage: "FORBIDDEN — only superadmin/partner_admin can switch tenants",
      },
      { status: 403 }
    );
  }

  // 4) Assinar e setar cookie
  const token = await signOverride({ tenantId: target.id, userId });
  const jar = await cookies();
  jar.set(OVERRIDE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OVERRIDE_TTL_SECONDS,
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: target.id,
      slug: target.slug,
      isPlatformOwner: target.is_platform_owner,
      isPartner: target.is_partner,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  }
  const jar = await cookies();
  jar.delete(OVERRIDE_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
