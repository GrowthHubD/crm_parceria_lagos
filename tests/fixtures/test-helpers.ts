/**
 * Helpers compartilhados pelos cenários de teste E2E.
 *
 * Estratégia: bate nos endpoints reais do deploy de prod com prefix `test-{nonce}-`
 * em todos os slugs/emails criados. No fim, cleanup remove tudo.
 *
 * Auth: usa SUPABASE_SERVICE_ROLE_KEY direto pra criar sessões de partner_admin /
 * superadmin pra testes (bypass do login UI). Variáveis necessárias em .env.local:
 *   - TEST_TARGET_URL (ex: https://crm.methodgrowthhub.com.br)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TEST_PARTNER_EMAIL (email de um partner_admin existente em prod)
 *   - TEST_PARTNER_PASSWORD
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

export interface TestEnv {
  targetUrl: string;
  partnerEmail: string;
  partnerPassword: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  nonce: string;
}

export function loadEnv(): TestEnv {
  const required = [
    "TEST_TARGET_URL",
    "TEST_PARTNER_EMAIL",
    "TEST_PARTNER_PASSWORD",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
  }
  return {
    targetUrl: process.env.TEST_TARGET_URL!.replace(/\/$/, ""),
    partnerEmail: process.env.TEST_PARTNER_EMAIL!,
    partnerPassword: process.env.TEST_PARTNER_PASSWORD!,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    nonce: process.env.TEST_NONCE ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
}

/** Faz login via Supabase Auth e retorna { accessToken, userId, cookieHeader }. */
export async function loginAs(
  env: TestEnv,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; userId: string; cookieHeader: string }> {
  const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message ?? "no session"}`);
  }
  // Cookie compatível com supabase/ssr — os endpoints lêem isso via createSupabaseServer
  const ref = new URL(env.supabaseUrl).hostname.split(".")[0];
  const cookieValue = encodeURIComponent(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      provider_token: null,
      provider_refresh_token: null,
      user: data.user,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: "bearer",
    })
  );
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user!.id,
    cookieHeader: `sb-${ref}-auth-token=${cookieValue}`,
  };
}

/** POST /api/partner/clients */
export async function createClient_(
  env: TestEnv,
  cookieHeader: string,
  body: {
    name: string;
    slug: string;
    adminEmail?: string;
    adminName?: string;
    adminPassword?: string;
    plan?: string;
    reuseExistingUser?: boolean;
  }
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${env.targetUrl}/api/partner/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** GET /api/tenant/context */
export async function getContext(
  env: TestEnv,
  cookieHeader: string
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${env.targetUrl}/api/tenant/context`, {
    headers: { Cookie: cookieHeader },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** POST /api/partner/clients/[id]/access */
export async function clientAccess(
  env: TestEnv,
  cookieHeader: string,
  clientId: string,
  body: { action: "magic-link" } | { action: "reset-password"; newPassword: string }
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${env.targetUrl}/api/partner/clients/${clientId}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Gera identificadores únicos pro teste. */
export function testIds(env: TestEnv, scenario: string) {
  const base = `test-${env.nonce}-${scenario}`;
  return {
    slug: base,
    name: `Test ${scenario} ${env.nonce}`,
    adminEmail: `${base}-admin@test.local`,
    adminName: `Test Admin ${scenario}`,
    adminPassword: `TestPass-${env.nonce}-${scenario}`,
  };
}

export interface ScenarioResult {
  scenario: string;
  status: "PASS" | "FAIL";
  errors: string[];
  details?: Record<string, unknown>;
  durationMs: number;
}

export async function runScenario(
  name: string,
  fn: () => Promise<{ ok: boolean; errors?: string[]; details?: Record<string, unknown> }>
): Promise<ScenarioResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      scenario: name,
      status: result.ok ? "PASS" : "FAIL",
      errors: result.errors ?? [],
      details: result.details,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      scenario: name,
      status: "FAIL",
      errors: [e instanceof Error ? `${e.name}: ${e.message}` : String(e)],
      durationMs: Date.now() - start,
    };
  }
}
