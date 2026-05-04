/**
 * Orquestrador da suite multi-agente E2E.
 *
 * Roda todos os cenários em paralelo (cada um é um "agente"), agrega
 * resultados e imprime relatório consolidado. Sempre roda cleanup no fim.
 *
 * Uso:
 *   pnpm test:e2e
 *   pnpm test:e2e -- --only=A,B  (subset)
 *   pnpm test:e2e -- --skip-cleanup
 *
 * Variáveis de ambiente em .env.local:
 *   TEST_TARGET_URL=https://crm.methodgrowthhub.com.br
 *   TEST_PARTNER_EMAIL=...
 *   TEST_PARTNER_PASSWORD=...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
import "dotenv/config";
import { loadEnv, type ScenarioResult } from "../fixtures/test-helpers";
import {
  scenarioA,
  scenarioB,
  scenarioC,
  scenarioD,
  scenarioE,
  scenarioF,
  scenarioG,
  scenarioI,
  scenarioH_cleanup,
} from "./scenarios";

interface Args {
  only?: string[];
  skipCleanup?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--only=")) args.only = a.slice(7).split(",").map((s) => s.trim().toUpperCase());
    if (a === "--skip-cleanup") args.skipCleanup = true;
  }
  return args;
}

const ALL_SCENARIOS = [
  { id: "A", fn: scenarioA },
  { id: "B", fn: scenarioB },
  { id: "C", fn: scenarioC },
  { id: "D", fn: scenarioD },
  { id: "E", fn: scenarioE },
  { id: "F", fn: scenarioF },
  { id: "G", fn: scenarioG },
  { id: "I", fn: scenarioI },
];

async function main() {
  const args = parseArgs();
  const env = loadEnv();

  const selected = ALL_SCENARIOS.filter((s) => !args.only || args.only.includes(s.id));

  console.log("━".repeat(72));
  console.log(`E2E Multi-Agent Suite`);
  console.log(`Target:  ${env.targetUrl}`);
  console.log(`Partner: ${env.partnerEmail}`);
  console.log(`Nonce:   ${env.nonce}`);
  console.log(`Running: ${selected.map((s) => s.id).join(", ")}`);
  console.log("━".repeat(72));

  // Spawn paralelo de todos os cenários
  const results: ScenarioResult[] = await Promise.all(selected.map((s) => s.fn(env)));

  // Cleanup sempre roda no fim (a menos que skipCleanup)
  let cleanupResult: ScenarioResult | null = null;
  if (!args.skipCleanup) {
    console.log("\n→ Rodando cleanup...");
    cleanupResult = await scenarioH_cleanup(env);
  }

  // Relatório
  console.log("\n" + "━".repeat(72));
  console.log("RELATÓRIO");
  console.log("━".repeat(72));

  const padId = 14;
  const padStatus = 6;
  for (const r of results) {
    const sym = r.status === "PASS" ? "✓" : "✗";
    const dur = `${r.durationMs}ms`.padStart(8);
    console.log(`${sym} ${r.scenario.padEnd(padId)} ${r.status.padEnd(padStatus)} ${dur}`);
    if (r.status === "FAIL") {
      for (const err of r.errors) console.log(`   └─ ${err}`);
    }
    if (r.details) {
      console.log(`   └─ ${JSON.stringify(r.details)}`);
    }
  }
  if (cleanupResult) {
    const sym = cleanupResult.status === "PASS" ? "✓" : "✗";
    console.log(`\n${sym} ${cleanupResult.scenario}: ${JSON.stringify(cleanupResult.details ?? {})}`);
    if (cleanupResult.status === "FAIL") {
      for (const err of cleanupResult.errors) console.log(`   └─ ${err}`);
    }
  }

  console.log("━".repeat(72));
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.length - passed;
  console.log(`Total: ${passed}/${results.length} PASS, ${failed} FAIL`);
  console.log("━".repeat(72));

  process.exit(failed === 0 && (cleanupResult?.status ?? "PASS") === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error("Orchestrator crash:", e);
  process.exit(2);
});
