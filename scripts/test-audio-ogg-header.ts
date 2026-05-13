/**
 * C1 — Unit test: upload OGG/opus pro Supabase Storage e valida que
 * a URL pública serve com Content-Type correto.
 *
 * Uso: npx tsx scripts/test-audio-ogg-header.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { readFileSync } from "fs";
import { join } from "path";
import { uploadWhatsappMedia, deleteWhatsappMedia, pathFromPublicUrl } from "../src/lib/supabase-storage";

const FIXTURE = join(__dirname, "..", "tests", "fixtures", "sample.ogg");
const TENANT = "abb28c63-6231-4a5a-beec-80b93054bf6f"; // acme-teste-1
const CONV = "test-conv-c1";

async function main() {
  const buf = readFileSync(FIXTURE);
  console.log(`→ fixture sample.ogg (${buf.length} bytes, magic=${buf.toString("ascii", 0, 4)})`);

  if (buf.toString("ascii", 0, 4) !== "OggS") {
    throw new Error("fixture inválido — não começa com OggS");
  }

  // 1) upload Buffer com mimetype audio/ogg
  const uploaded = await uploadWhatsappMedia({
    tenantId: TENANT,
    conversationId: CONV,
    data: buf,
    mimetype: "audio/ogg",
    filename: "test-c1.ogg",
  });
  if (!uploaded) throw new Error("upload retornou null");
  console.log(`✓ uploaded path=${uploaded.path}`);
  console.log(`  url=${uploaded.publicUrl}`);

  // 2) HEAD na URL pública → checa Content-Type
  const head = await fetch(uploaded.publicUrl, { method: "HEAD" });
  const ct = head.headers.get("content-type") ?? "";
  console.log(`✓ HEAD ${head.status} content-type="${ct}"`);
  if (!ct.includes("audio/ogg")) {
    throw new Error(`Content-Type errado: esperado audio/ogg, recebido "${ct}"`);
  }

  // 3) GET e compara bytes
  const get = await fetch(uploaded.publicUrl);
  const ab = await get.arrayBuffer();
  const downloaded = Buffer.from(ab);
  if (downloaded.length !== buf.length) {
    throw new Error(`tamanho diverge: subiu ${buf.length}B, baixou ${downloaded.length}B`);
  }
  if (downloaded.toString("ascii", 0, 4) !== "OggS") {
    throw new Error("downloaded não começa com OggS");
  }
  console.log(`✓ GET roundtrip OK (${downloaded.length}B)`);

  // 4) cleanup
  const path = pathFromPublicUrl(uploaded.publicUrl);
  if (path) {
    const ok = await deleteWhatsappMedia(path);
    console.log(`${ok ? "✓" : "✗"} cleanup ${path}`);
  }

  console.log("\nC1 PASS");
}

main().catch((e) => {
  console.error("\nC1 FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
