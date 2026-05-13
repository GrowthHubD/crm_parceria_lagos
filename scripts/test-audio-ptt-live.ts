/**
 * C3 — Live test: dispara OGG/opus diretamente via Uazapi pro número
 * 5521991913946 (heliobot/acme) e verifica que chega como PTT.
 *
 * Assert: HTTP 200 + body confirma PTT. **Validação visual no celular**
 * é necessária pra confirmar balão de voz vs anexo.
 *
 * Uso: npx tsx scripts/test-audio-ptt-live.ts
 *
 * Env opcionais:
 *   UAZ_TEST_TOKEN  (default = heliobot token)
 *   UAZ_TARGET      (default = próprio número heliobot)
 *   UAZ_SERVER      (default = growthhub.uazapi.com)
 */
import { readFileSync } from "fs";
import { join } from "path";

const SERVER = process.env.UAZ_SERVER ?? "https://growthhub.uazapi.com";
const TOKEN = process.env.UAZ_TEST_TOKEN ?? "d7db5ff9-a73b-4dda-9808-3b1125971b3c";
const TARGET = process.env.UAZ_TARGET ?? "5521991913946";

async function main() {
  const oggPath = join(__dirname, "..", "tests", "fixtures", "sample.ogg");
  const buf = readFileSync(oggPath);
  console.log(`→ fixture ${oggPath} (${buf.length}B)`);
  if (buf.toString("ascii", 0, 4) !== "OggS") {
    throw new Error("fixture não tem magic OggS");
  }
  const b64 = buf.toString("base64");
  const dataUri = `data:audio/ogg;codecs=opus;base64,${b64}`;

  console.log(`→ POST ${SERVER}/send/media (type=ptt, target=${TARGET})`);
  const r = await fetch(`${SERVER}/send/media`, {
    method: "POST",
    headers: { token: TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: TARGET,
      type: "ptt",
      file: dataUri,
    }),
  });
  const data = await r.json().catch(() => ({}));
  console.log(`  status=${r.status}`);
  console.log(`  response: ${JSON.stringify(data, null, 2).slice(0, 400)}`);

  if (!r.ok) {
    console.error("\nC3 FAIL: Uazapi recusou o envio");
    process.exit(1);
  }

  console.log("\n✓ envio aceito pelo Uazapi");
  console.log("\nC3 PARCIAL — VALIDAÇÃO MANUAL NECESSÁRIA:");
  console.log(`  abra o WhatsApp do ${TARGET}`);
  console.log("  procure a última mensagem recebida nesse número:");
  console.log("    🟢 PASS = balão de voz com waveform e botão play");
  console.log("    🔴 FAIL = chip de áudio com botão BAIXAR (anexo)");
  console.log("\n(o fixture é 1s de silêncio sintético — basta confirmar a UI, não o áudio)");
}

main().catch((e) => {
  console.error("\nC3 CRASH:", e instanceof Error ? e.message : e);
  process.exit(2);
});
