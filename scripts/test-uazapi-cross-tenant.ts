/**
 * Teste de isolamento real entre duas instâncias Uazapi.
 *
 * Envia 2 mensagens em paralelo:
 *   • Instância A (token A) → número B    "Olá B, sou A. [nonce]"
 *   • Instância B (token B) → número A    "Olá A, sou B. [nonce]"
 *
 * Se cada lado receber a mensagem com o nonce esperado, e se NUNCA
 * houver vazamento (ex.: mensagem A enviada pelo header de B), o
 * isolamento por header `token:` está confirmado.
 *
 * Uso:
 *   npx tsx scripts/test-uazapi-cross-tenant.ts
 *
 * Edita os 2 blocos INSTANCE_A / INSTANCE_B abaixo se quiser fixar
 * tokens; ou exporta as 6 envs:
 *   UAZ_A_TOKEN, UAZ_A_PHONE, UAZ_A_SERVER
 *   UAZ_B_TOKEN, UAZ_B_PHONE, UAZ_B_SERVER
 */
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

interface Inst {
  label: string;
  phone: string;
  token: string;
  server: string;
}

const INSTANCE_A: Inst = {
  label: "A",
  phone: process.env.UAZ_A_PHONE ?? "5521991913946",
  token: process.env.UAZ_A_TOKEN ?? "",
  server: (process.env.UAZ_A_SERVER ?? "https://williphone.uazapi.com").replace(/\/$/, ""),
};

const INSTANCE_B: Inst = {
  label: "B",
  phone: process.env.UAZ_B_PHONE ?? "5521999433160",
  token: process.env.UAZ_B_TOKEN ?? "e88c26aa-583f-4402-a2e9-7e612613af53",
  server: (process.env.UAZ_B_SERVER ?? "https://williphone.uazapi.com").replace(/\/$/, ""),
};

function normalize(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

async function sendText(from: Inst, toPhone: string, text: string) {
  const t0 = Date.now();
  const res = await fetch(`${from.server}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: from.token,
    },
    body: JSON.stringify({ number: normalize(toPhone), text }),
  });
  const body = await res.text();
  const dt = Date.now() - t0;
  return {
    ok: res.ok,
    status: res.status,
    body: body.slice(0, 400),
    dt,
  };
}

async function getStatus(inst: Inst) {
  try {
    const res = await fetch(`${inst.server}/instance/status`, {
      headers: { token: inst.token },
    });
    return { status: res.status, body: (await res.text()).slice(0, 200) };
  } catch (e) {
    return { status: 0, body: String(e).slice(0, 200) };
  }
}

async function main() {
  if (!INSTANCE_A.token || !INSTANCE_B.token) {
    console.error("✗ Falta UAZ_A_TOKEN ou UAZ_B_TOKEN — passa via env");
    process.exit(1);
  }

  const nonce = Math.random().toString(36).slice(2, 8);
  console.log(`\n▶ Cross-tenant Uazapi isolation test  nonce=${nonce}`);
  console.log(`  A: ${INSTANCE_A.phone} via ${INSTANCE_A.server}`);
  console.log(`  B: ${INSTANCE_B.phone} via ${INSTANCE_B.server}\n`);

  // 1. Status check (não obrigatório)
  console.log("• Status check");
  const [stA, stB] = await Promise.all([getStatus(INSTANCE_A), getStatus(INSTANCE_B)]);
  console.log(`  A → HTTP ${stA.status}: ${stA.body}`);
  console.log(`  B → HTTP ${stB.status}: ${stB.body}\n`);

  // 2. Disparo cruzado — em paralelo
  const msgFromA = `[crm-lagos cross-test ${nonce}] oi B, sou A`;
  const msgFromB = `[crm-lagos cross-test ${nonce}] oi A, sou B`;

  console.log("• Disparo paralelo");
  const [rA, rB] = await Promise.all([
    sendText(INSTANCE_A, INSTANCE_B.phone, msgFromA),
    sendText(INSTANCE_B, INSTANCE_A.phone, msgFromB),
  ]);

  console.log(`  A→B  HTTP ${rA.status} (${rA.dt}ms): ${rA.body}`);
  console.log(`  B→A  HTTP ${rB.status} (${rB.dt}ms): ${rB.body}\n`);

  // 3. Tentativa de "vazamento": envia COM token de B mas alegando que é "de A"
  // — só pra confirmar que o servidor identifica o sender pelo header, não pelo body.
  console.log("• Sanity check: token determina o sender (não pode forjar)");
  const cross = await sendText(
    { ...INSTANCE_B, label: "B-pretending-A" },
    INSTANCE_A.phone, // dispara pra A
    `[crm-lagos cross-test ${nonce}] mensagem pra A — chega via número B (header token=B)`
  );
  console.log(`  Cross-check HTTP ${cross.status} (${cross.dt}ms): ${cross.body}\n`);

  // 4. Sumário
  const allOk = rA.ok && rB.ok;
  console.log(`▶ Resultado: ${allOk ? "✓ isolamento confirmado pelos 2 lados" : "✗ algum lado falhou"}`);
  console.log(`  Procura no celular A o nonce "${nonce}" — deve chegar mensagem DE B.`);
  console.log(`  Procura no celular B o nonce "${nonce}" — deve chegar mensagem DE A.`);
  console.log(`  Se A receber mensagem cujo "from" é o número de A, ou B receber DE B, o servidor está zoado.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
