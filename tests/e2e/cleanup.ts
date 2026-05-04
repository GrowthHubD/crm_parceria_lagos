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

  const { data: tenants, error } = await sb.from("tenant").select("id, slug").like("slug", "test-%");
  if (error) {
    console.error("List falhou:", error.message);
    process.exit(1);
  }
  console.log(`Encontrados ${tenants?.length ?? 0} tenants test-*`);

  if ((tenants?.length ?? 0) > 0) {
    const ids = tenants!.map((t) => t.id);
    const { error: delErr } = await sb.from("tenant").delete().in("id", ids);
    if (delErr) {
      console.error("Delete falhou:", delErr.message);
      process.exit(1);
    }
    console.log(`✓ Deletados ${ids.length} tenants`);
  }

  const { data: usersList } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = (usersList?.users ?? []).filter((u) => u.email?.includes("test-"));
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
