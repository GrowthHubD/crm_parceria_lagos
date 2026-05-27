/**
 * scripts/bootstrap-tenant-pipeline.ts <tenant-slug>
 *
 * Cria o "Funil principal" + 5 stages padrão pra um tenant que ficou sem
 * (provisionClient não rodou ou rodou parcial). Idempotente — se já houver
 * pipeline default, não duplica.
 *
 * Stages padrão (mesmos de provisionClient):
 *   0. Novo          (#6B7280, cinza)
 *   1. Em contato    (#3B82F6, azul)
 *   2. Negociação    (#F59E0B, ambar)
 *   3. Ganho         (#10B981, verde, isWon=true)
 *   4. Perdido       (#EF4444, vermelho)
 *
 * Uso:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/bootstrap-tenant-pipeline.ts alexandre
 */
import "dotenv/config";
import postgres from "postgres";

const STAGES = [
  { name: "Novo",        order: 0, color: "#6B7280", isWon: false },
  { name: "Em contato",  order: 1, color: "#3B82F6", isWon: false },
  { name: "Negociação",  order: 2, color: "#F59E0B", isWon: false },
  { name: "Ganho",       order: 3, color: "#10B981", isWon: true  },
  { name: "Perdido",     order: 4, color: "#EF4444", isWon: false },
];

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npx tsx scripts/bootstrap-tenant-pipeline.ts <tenant-slug>");
    process.exit(1);
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    const [t] = await sql<Array<{ id: string; name: string }>>`
      SELECT id, name FROM tenant WHERE slug = ${slug} LIMIT 1
    `;
    if (!t) {
      console.error(`✗ Tenant slug="${slug}" não existe`);
      process.exit(1);
    }
    console.log(`→ Tenant: ${slug} (${t.name}) — ${t.id}`);

    // 1) Pipeline default — só cria se não tiver nenhum
    const existingPipes = await sql<Array<{ id: string; name: string; isDefault: boolean }>>`
      SELECT id, name, is_default AS "isDefault" FROM pipeline WHERE tenant_id = ${t.id}
    `;
    let pipelineId: string;
    if (existingPipes.length === 0) {
      const [p] = await sql<Array<{ id: string }>>`
        INSERT INTO pipeline (tenant_id, name, description, is_default)
        VALUES (${t.id}, 'Funil principal', 'Funil padrão criado via bootstrap', true)
        RETURNING id
      `;
      pipelineId = p.id;
      console.log(`✓ Pipeline criado: ${pipelineId.slice(0, 8)}…`);
    } else {
      const def = existingPipes.find((p) => p.isDefault) ?? existingPipes[0];
      pipelineId = def.id;
      console.log(`· Pipeline já existe: ${pipelineId.slice(0, 8)}… name="${def.name}" default=${def.isDefault}`);
    }

    // 2) Stages — verifica quais já existem (por nome+pipeline) e insere ausentes
    const existingStages = await sql<Array<{ name: string }>>`
      SELECT name FROM pipeline_stage WHERE tenant_id = ${t.id} AND pipeline_id = ${pipelineId}
    `;
    const existingNames = new Set(existingStages.map((s) => s.name));

    let created = 0;
    for (const s of STAGES) {
      if (existingNames.has(s.name)) {
        console.log(`· Stage "${s.name}" já existe (skip)`);
        continue;
      }
      await sql`
        INSERT INTO pipeline_stage (tenant_id, pipeline_id, name, "order", color, is_won)
        VALUES (${t.id}, ${pipelineId}, ${s.name}, ${s.order}, ${s.color}, ${s.isWon})
      `;
      console.log(`✓ Stage "${s.name}" criado`);
      created++;
    }

    console.log(`\n${created > 0 ? "✓" : "·"} Concluído. ${created} stage(s) criado(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
