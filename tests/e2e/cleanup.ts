/**
 * Cleanup standalone — apaga TODOS os tenants test-* (qualquer nonce).
 * Use quando run-multiagent crashou e deixou lixo.
 *
 *   pnpm test:cleanup
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key);

  // Preserva fixture do partner de teste (test-e2e-partner-tenant)
  const PRESERVED_SLUGS = ["test-e2e-partner-tenant"];
  const PRESERVED_EMAILS = ["test-e2e-partner@test.local"];
  const { data: tenants, error } = await sb
    .from("tenant")
    .select("id, slug")
    .like("slug", "test-%")
    .not("slug", "in", `(${PRESERVED_SLUGS.map((s) => `"${s}"`).join(",")})`);
  if (error) {
    console.error("List falhou:", error.message);
    process.exit(1);
  }
  console.log(`Encontrados ${tenants?.length ?? 0} tenants test-*`);

  if ((tenants?.length ?? 0) > 0) {
    const ids = tenants!.map((t) => t.id);

    // Tabelas SEM tenant_id direto — limpa via FK transitiva ANTES das pais.
    // crm_message → crm_conversation
    const { data: convs } = await sb
      .from("crm_conversation")
      .select("id")
      .in("tenant_id", ids);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    if (convIds.length > 0) {
      await sb.from("crm_message").delete().in("conversation_id", convIds);
      await sb.from("crm_conversation_tag").delete().in("conversation_id", convIds);
    }

    // automation_step / automation_step_version / automation_log → automation
    const { data: autos } = await sb
      .from("automation")
      .select("id")
      .in("tenant_id", ids);
    const autoIds = (autos ?? []).map((a: { id: string }) => a.id);
    if (autoIds.length > 0) {
      await sb.from("automation_log").delete().in("automation_id", autoIds);
      await sb.from("automation_step_version").delete().in("automation_id", autoIds);
      await sb.from("automation_step").delete().in("automation_id", autoIds);
    }

    // lead_tag_assignment → lead
    const { data: leads } = await sb.from("lead").select("id").in("tenant_id", ids);
    const leadIds = (leads ?? []).map((l: { id: string }) => l.id);
    if (leadIds.length > 0) {
      await sb.from("lead_tag_assignment").delete().in("lead_id", leadIds);
    }

    // baileys_auth_state → whatsapp_number
    const { data: wnums } = await sb
      .from("whatsapp_number")
      .select("id")
      .in("tenant_id", ids);
    const wnumIds = (wnums ?? []).map((w: { id: string }) => w.id);
    if (wnumIds.length > 0) {
      await sb.from("baileys_auth_state").delete().in("whatsapp_number_id", wnumIds);
    }

    // client_file / client_responsible → client
    const { data: clients } = await sb
      .from("client")
      .select("id")
      .in("tenant_id", ids);
    const clientIds = (clients ?? []).map((c: { id: string }) => c.id);
    if (clientIds.length > 0) {
      await sb.from("client_file").delete().in("client_id", clientIds);
      await sb.from("client_responsible").delete().in("client_id", clientIds);
    }

    // blog_post_tag → blog_post
    const { data: posts } = await sb
      .from("blog_post")
      .select("id")
      .in("tenant_id", ids);
    const postIds = (posts ?? []).map((p: { id: string }) => p.id);
    if (postIds.length > 0) {
      await sb.from("blog_post_tag").delete().in("post_id", postIds);
    }

    // Ordem topológica: filhas primeiro, depois pais
    const cleanupTables = [
      "lead_tag",
      "kanban_task",
      "kanban_column",
      "notification",
      "client",
      "contract",
      "financial_transaction",
      "financial_config",
      "sdr_metric_snapshot",
      "sdr_agent",
      "blog_post",
      "blog_category",
      "message_template",
      "automation",
      "crm_conversation",
      "whatsapp_number",
      "lead",
      "pipeline_stage",
      "pipeline",
      "user_tenant",
    ];
    for (const tbl of cleanupTables) {
      const { error: tblErr } = await sb.from(tbl).delete().in("tenant_id", ids);
      if (tblErr) console.warn(`  ⚠ ${tbl}: ${tblErr.message}`);
    }

    const { error: delErr } = await sb.from("tenant").delete().in("id", ids);
    if (delErr) {
      console.error("Delete tenant falhou:", delErr.message);
      process.exit(1);
    }
    console.log(`✓ Deletados ${ids.length} tenants`);
  }

  const { data: usersList } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = (usersList?.users ?? []).filter(
    (u) => u.email?.includes("test-") && !PRESERVED_EMAILS.includes(u.email ?? "")
  );
  console.log(`Encontrados ${testUsers.length} users test-*`);

  let deleted = 0;
  for (const u of testUsers) {
    const { error: dErr } = await sb.auth.admin.deleteUser(u.id);
    if (!dErr) deleted++;
  }
  if (testUsers.length > 0) {
    await sb.from("user").delete().in("id", testUsers.map((u) => u.id));
  }
  console.log(`✓ Deletados ${deleted} users`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
