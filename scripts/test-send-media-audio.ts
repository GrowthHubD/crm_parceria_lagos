/**
 * C2 — Integração: testa o endpoint /api/crm/[id]/send-media com áudio OGG/opus
 * válido (aceita 200) e com webm (rejeita 400).
 *
 * Requer: `npx pnpm dev` rodando em outro terminal + sessão Supabase válida.
 *
 * Uso: TEST_PARTNER_EMAIL=... TEST_PARTNER_PASSWORD=... npx tsx scripts/test-send-media-audio.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const TARGET = process.env.TEST_TARGET_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_PARTNER_EMAIL!;
const PASS = process.env.TEST_PARTNER_PASSWORD!;
const ACME_TENANT = "abb28c63-6231-4a5a-beec-80b93054bf6f";

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

async function authenticate(): Promise<string> {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supa.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (error || !data.session) throw new Error(`auth falhou: ${error?.message}`);
  // Cookie compat com supabase/ssr
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
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
  return `sb-${ref}-auth-token=${cookieValue}`;
}

async function getFirstConversationId(cookie: string): Promise<string> {
  const r = await fetch(`${TARGET}/api/crm`, {
    headers: {
      Cookie: cookie,
      "x-tenant-override": ACME_TENANT,
    },
  });
  if (!r.ok) throw new Error(`/api/crm ${r.status}`);
  const data = await r.json();
  const conv = data.conversations?.[0] ?? data[0];
  if (!conv?.id) throw new Error("nenhuma conversa no tenant acme");
  return conv.id;
}

async function postSendMedia(
  cookie: string,
  convId: string,
  body: { file: string; fileName: string; isAudio: boolean }
): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${TARGET}/api/crm/${convId}/send-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "x-tenant-override": ACME_TENANT,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  console.log(`→ target=${TARGET}`);
  const auth = await authenticate();
  console.log("✓ autenticado");

  const convId = await getFirstConversationId(auth);
  console.log(`✓ conversation=${convId}`);

  const oggBuf = readFileSync(join(__dirname, "..", "tests", "fixtures", "sample.ogg"));
  const oggB64 = oggBuf.toString("base64");

  const results: Result[] = [];

  // Test 1: OGG válido → 200
  console.log("\n→ test 1: OGG válido → 200");
  const ok = await postSendMedia(auth, convId, {
    file: `data:audio/ogg;codecs=opus;base64,${oggB64}`,
    fileName: `c2-test-${Date.now()}.ogg`,
    isAudio: true,
  });
  console.log(`  status=${ok.status}`);
  if (ok.status === 200) {
    const msg = ok.data.message as Record<string, unknown> | undefined;
    const mediaUrl = (msg?.mediaUrl as string | undefined) ?? "";
    const mediaType = msg?.mediaType as string | undefined;
    const isOggUrl = mediaUrl.includes(".ogg");
    const isAudio = mediaType === "audio";
    results.push({
      name: "OGG válido aceito",
      ok: isOggUrl && isAudio,
      detail: `mediaType=${mediaType}, mediaUrl=${mediaUrl.slice(0, 80)}...`,
    });
  } else {
    results.push({
      name: "OGG válido aceito",
      ok: false,
      detail: `status=${ok.status}, body=${JSON.stringify(ok.data).slice(0, 200)}`,
    });
  }

  // Test 2: webm → 400
  console.log("\n→ test 2: webm → 400");
  const webmB64 = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).toString("base64"); // EBML magic
  const bad = await postSendMedia(auth, convId, {
    file: `data:audio/webm;codecs=opus;base64,${webmB64}`,
    fileName: `c2-test-${Date.now()}.webm`,
    isAudio: true,
  });
  console.log(`  status=${bad.status}`);
  results.push({
    name: "webm rejeitado com 400",
    ok: bad.status === 400 && String(bad.data.error ?? "").toLowerCase().includes("ogg"),
    detail: `status=${bad.status}, error=${bad.data.error}`,
  });

  // Relatório
  console.log("\n" + "━".repeat(64));
  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}`);
    console.log(`   ${r.detail}`);
    if (r.ok) pass++;
  }
  console.log("━".repeat(64));
  console.log(`C2 ${pass}/${results.length} ${pass === results.length ? "PASS" : "FAIL"}`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("\nC2 CRASH:", e instanceof Error ? e.message : e);
  process.exit(2);
});
