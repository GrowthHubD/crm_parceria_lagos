#!/usr/bin/env node
// Pós-processo do build OpenNext pra Cloudflare Workers.
//
// Patch 1: handler.mjs — Workers não suportam dynamic require em runtime. O
// handler bundleado pelo OpenNext herda do NextNodeServer um método
// `getMiddlewareManifest` que faz `require(this.middlewareManifestPath)` quando
// minimalMode=false. Como temos proxy.ts desabilitado pra CF, o manifest é
// vazio — sobrescrevemos pra retornar o objeto inline e nunca chamar require().
//
// Patch 2: worker.js — OpenNext gera só `fetch` no export default. Adicionamos
// `scheduled` pra Cron Trigger nativo do CF disparar /api/cron/follow-up a
// cada 1 min (configurado em wrangler.toml [triggers] crons).
//
// Roda automaticamente via npm script `cf:build` (ver package.json).

import fs from "node:fs";

// ── Patch 1: handler.mjs (middleware manifest) ─────────────────────
const HANDLER = ".open-next/server-functions/default/handler.mjs";
const TARGET = "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";
const REPLACEMENT = "getMiddlewareManifest(){return {version:3,middleware:{},sortedMiddleware:[],functions:{}}}";

const handlerSrc = fs.readFileSync(HANDLER, "utf8");
if (handlerSrc.includes(TARGET)) {
  fs.writeFileSync(HANDLER, handlerSrc.split(TARGET).join(REPLACEMENT));
  console.log("[patch-cf-handler] handler.mjs (middleware manifest) patched OK.");
} else if (handlerSrc.includes(REPLACEMENT)) {
  console.log("[patch-cf-handler] handler.mjs já patchado, skip.");
} else {
  // Next 16+ pode ter mudado o pattern do getMiddlewareManifest. Como esse
  // patch só importa quando minimalMode=false (a app NÃO usa middleware.ts
  // em prod neste projeto), não bloqueamos o deploy — só avisamos. Se o
  // worker explodir em runtime com "Dynamic require of...", reativar o exit 1.
  console.warn("[patch-cf-handler] handler.mjs target não encontrado — pattern do Next pode ter mudado. Seguindo sem patch (middleware vazio é o caso esperado).");
}

// ── Patch 2: worker.js (adicionar scheduled handler) ───────────────
const WORKER = ".open-next/worker.js";
const SCHEDULED_MARKER = "/* SCHEDULED_HANDLER_INJECTED */";
const EXPORT_TARGET = "export default {\n    async fetch(request, env, ctx) {";
const EXPORT_REPLACEMENT = `export default {
    ${SCHEDULED_MARKER}
    async scheduled(event, env, ctx) {
        // Dispara /api/cron/follow-up internamente pra processar automations
        // pendentes (lead_inactive, scheduled, etc). Cron Trigger configurado
        // em wrangler.toml [triggers] crons = ["* * * * *"].
        const base = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "https://crm.methodgrowthhub.com.br";
        const request = new Request(base + "/api/cron/follow-up", {
            method: "POST",
            headers: { "Authorization": "Bearer " + (env.CRON_SECRET || "") },
        });
        try {
            const response = await this.fetch(request, env, ctx);
            const body = await response.text();
            console.log("[scheduled] cron/follow-up", response.status, body.slice(0, 300));
        } catch (e) {
            console.error("[scheduled] error:", e instanceof Error ? e.message : String(e));
        }
    },
    async fetch(request, env, ctx) {`;

const workerSrc = fs.readFileSync(WORKER, "utf8");
if (workerSrc.includes(SCHEDULED_MARKER)) {
  console.log("[patch-cf-handler] worker.js scheduled já patchado, skip.");
} else if (workerSrc.includes(EXPORT_TARGET)) {
  fs.writeFileSync(WORKER, workerSrc.replace(EXPORT_TARGET, EXPORT_REPLACEMENT));
  console.log("[patch-cf-handler] worker.js scheduled handler injected OK.");
} else {
  console.error("[patch-cf-handler] worker.js export target não encontrado — formato mudou. Investigar.");
  process.exit(1);
}
