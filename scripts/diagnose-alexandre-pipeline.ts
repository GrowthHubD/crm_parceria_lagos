import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const [t] = await sql<Array<{ id: string; slug: string; name: string }>>`
      SELECT id, slug, name FROM tenant WHERE slug = 'alexandre' LIMIT 1
    `;
    if (!t) {
      console.log("Tenant slug='alexandre' não existe");
      return;
    }
    console.log("Tenant:", t);

    const pipelines = await sql<Array<{ id: string; name: string; isDefault: boolean }>>`
      SELECT id, name, is_default AS "isDefault" FROM pipeline WHERE tenant_id = ${t.id}
    `;
    console.log(`\nPipelines (${pipelines.length}):`);
    for (const p of pipelines) console.log(`  ${p.id.slice(0,8)}… name="${p.name}" default=${p.isDefault}`);

    const stages = await sql<Array<{ id: string; name: string; order: number; pipelineId: string }>>`
      SELECT id, name, "order", pipeline_id AS "pipelineId"
      FROM pipeline_stage WHERE tenant_id = ${t.id} ORDER BY "order"
    `;
    console.log(`\nStages (${stages.length}):`);
    for (const s of stages) console.log(`  order=${s.order} name="${s.name}" pipeline=${s.pipelineId.slice(0,8)}…`);

    const [{ leads }] = await sql<Array<{ leads: number }>>`
      SELECT COUNT(*)::int AS leads FROM lead WHERE tenant_id = ${t.id}
    `;
    console.log(`\nLeads no tenant: ${leads}`);

    const recentLeads = await sql<Array<{ id: string; name: string; phone: string | null; stageId: string }>>`
      SELECT id, name, phone, stage_id AS "stageId"
      FROM lead WHERE tenant_id = ${t.id}
      ORDER BY created_at DESC LIMIT 5
    `;
    console.log("\nLeads recentes (5):");
    for (const l of recentLeads) console.log(`  ${l.id.slice(0,8)}… name="${l.name}" phone=${l.phone}`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
