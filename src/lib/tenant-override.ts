/**
 * Tenant override token (cookie `gh-tenant-override`).
 *
 * Cookie httpOnly assinado com HMAC-SHA-256 + BETTER_AUTH_SECRET. Permite
 * superadmin/partner_admin trocar de contexto de tenant sem deslogar. Cookie
 * acompanha automaticamente todo fetch (SSR e client) — `getTenantContext()`
 * lê o cookie e usa o tenantId como se fosse o header `x-tenant-id`.
 *
 * Por que WebCrypto e não `node:crypto`: Cloudflare Workers não tem node:crypto
 * disponível em todos os runtimes. WebCrypto roda nativo em Workers + Node 20+.
 */

const encoder = new TextEncoder();

export const OVERRIDE_COOKIE_NAME = "gh-tenant-override";
export const OVERRIDE_TTL_SECONDS = 4 * 60 * 60; // 4h

interface OverridePayload {
  tenantId: string;
  userId: string;
  exp: number; // unix seconds
}

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET ausente");
  return s;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

export async function signOverride(input: { tenantId: string; userId: string }): Promise<string> {
  const payload: OverridePayload = {
    tenantId: input.tenantId,
    userId: input.userId,
    exp: Math.floor(Date.now() / 1000) + OVERRIDE_TTL_SECONDS,
  };
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const b64Payload = b64urlEncode(payloadBytes);

  const key = await getKey("sign");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(b64Payload)));
  return `${b64Payload}.${b64urlEncode(sig)}`;
}

export async function verifyOverride(
  token: string,
  expectedUserId: string
): Promise<{ tenantId: string } | null> {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const b64Payload = token.slice(0, dot);
  const b64Sig = token.slice(dot + 1);

  let sigBytes: Uint8Array;
  try {
    sigBytes = b64urlDecode(b64Sig);
  } catch {
    return null;
  }

  let key: CryptoKey;
  try {
    key = await getKey("verify");
  } catch {
    return null;
  }

  // crypto.subtle.verify é constant-time. Slice produz ArrayBuffer concreto
  // (alguns runtimes TS reclamam de Uint8Array<ArrayBufferLike> direto).
  const sigBuf = sigBytes.buffer.slice(
    sigBytes.byteOffset,
    sigBytes.byteOffset + sigBytes.byteLength
  );
  const ok = await crypto.subtle.verify("HMAC", key, sigBuf, encoder.encode(b64Payload));
  if (!ok) return null;

  let payload: OverridePayload;
  try {
    const json = new TextDecoder().decode(b64urlDecode(b64Payload));
    payload = JSON.parse(json) as OverridePayload;
  } catch {
    return null;
  }

  if (!payload.tenantId || !payload.userId || typeof payload.exp !== "number") return null;
  if (payload.userId !== expectedUserId) return null; // bloqueia roubo cross-user
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return { tenantId: payload.tenantId };
}

/**
 * Lê o valor do cookie gh-tenant-override do header Cookie cru.
 * Retorna null se ausente ou cookie header não vier.
 */
export function readOverrideCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const name = p.slice(0, eq).trim();
    if (name === OVERRIDE_COOKIE_NAME) {
      return decodeURIComponent(p.slice(eq + 1).trim());
    }
  }
  return null;
}
