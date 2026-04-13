/**
 * Seed script: cria tenant GH, popula tenant_id nas tabelas existentes,
 * cria user_tenant para users existentes, e seed de dados base.
 * Roda com: npx tsx src/lib/db/seed.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull } from "drizzle-orm";
import { user, userTenant } from "./schema/users";
import { tenant as tenantTable } from "./schema/tenants";
import { kanbanColumn, kanbanTask } from "./schema/kanban";
import { pipelineStage, lead, leadTag } from "./schema/pipeline";
import { client } from "./schema/clients";
import { contract } from "./schema/contracts";
import { financialTransaction, financialConfig } from "./schema/financial";
import { whatsappNumber, crmConversation } from "./schema/crm";
import { blogCategory, blogPost } from "./schema/blog";
import { sdrAgent, sdrMetricSnapshot } from "./schema/sdr";
import { notification } from "./schema/notifications";
import { messageTemplate } from "./schema/settings";
import { auth } from "../auth";

const GH_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

async function seed() {
  console.log("Seeding database...\n");

  // ============================================
  // 0. Criar tenant Growth Hub
  // ============================================
  console.log("--- Tenant GH ---");
  try {
    await db
      .insert(tenantTable)
      .values({
        id: GH_TENANT_ID,
        name: "Growth Hub",
        slug: "growth-hub",
        isPlatformOwner: true,
        status: "active",
      })
      .onConflictDoNothing();
    console.log("  [OK] Tenant GH criado");
  } catch (e) {
    console.log("  [SKIP] Tenant GH já existe:", e);
  }

  // ============================================
  // 1. Criar users base via better-auth
  // ============================================
  console.log("\n--- Users ---");
  const usersToCreate = [
    {
      name: "Davi Barreto",
      email: "davi@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "partner" as const,
    },
    {
      name: "Gerente GH",
      email: "gerente@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "manager" as const,
    },
    {
      name: "Operacional GH",
      email: "operacional@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "operational" as const,
    },
  ];

  for (const u of usersToCreate) {
    try {
      const ctx = await auth.api.signUpEmail({
        body: { name: u.name, email: u.email, password: u.password },
      });
      if (ctx?.user?.id) {
        await db.update(user).set({ role: u.role }).where(eq(user.id, ctx.user.id));
        console.log(`  [OK] User: ${u.email} (${u.role})`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already") || msg.includes("UNIQUE") || msg.includes("duplicate")) {
        console.log(`  [SKIP] User já existe: ${u.email}`);
      } else {
        console.error(`  [FAIL] ${u.email}:`, msg);
      }
    }
  }

  // ============================================
  // 2. Popular tenant_id em todas as tabelas existentes
  // ============================================
  console.log("\n--- Populando tenant_id ---");

  const tables = [
    { name: "pipeline_stage", table: pipelineStage },
    { name: "lead", table: lead },
    { name: "lead_tag", table: leadTag },
    { name: "client", table: client },
    { name: "contract", table: contract },
    { name: "financial_transaction", table: financialTransaction },
    { name: "financial_config", table: financialConfig },
    { name: "whatsapp_number", table: whatsappNumber },
    { name: "crm_conversation", table: crmConversation },
    { name: "kanban_column", table: kanbanColumn },
    { name: "kanban_task", table: kanbanTask },
    { name: "blog_category", table: blogCategory },
    { name: "blog_post", table: blogPost },
    { name: "sdrAgent", table: sdrAgent },
    { name: "notification", table: notification },
    { name: "message_template", table: messageTemplate },
  ];

  for (const { name, table: t } of tables) {
    try {
      // @ts-expect-error - dynamic table access
      const result = await db.update(t).set({ tenantId: GH_TENANT_ID }).where(isNull(t.tenantId));
      console.log(`  [OK] ${name}: tenant_id populado`);
    } catch (e) {
      console.log(`  [SKIP] ${name}: ${e}`);
    }
  }

  // sdr_metric_snapshot não tem tenantId direto (herda via sdrAgent)
  // Já coberto pelo sdrAgent acima

  // ============================================
  // 3. Criar user_tenant para todos os users existentes
  // ============================================
  console.log("\n--- user_tenant ---");
  const existingUsers = await db.select({ id: user.id, role: user.role }).from(user);

  for (const u of existingUsers) {
    try {
      // Davi vira superadmin, demais ficam admin do tenant GH
      const tenantRole = u.role === "partner" ? "superadmin" : "admin";
      await db
        .insert(userTenant)
        .values({
          userId: u.id,
          tenantId: GH_TENANT_ID,
          role: tenantRole,
          isDefault: true,
        })
        .onConflictDoNothing();
      console.log(`  [OK] user_tenant: ${u.id} → GH (${tenantRole})`);
    } catch (e) {
      console.log(`  [SKIP] user_tenant: ${u.id} → ${e}`);
    }
  }

  // ============================================
  // 4. Pipeline stages (se não existirem)
  // ============================================
  console.log("\n--- Pipeline Stages ---");
  const stages = [
    { name: "Sem Atendimento", order: 1, color: "#8B8B9E", tenantId: GH_TENANT_ID },
    { name: "Em Atendimento", order: 2, color: "#3B82F6", tenantId: GH_TENANT_ID },
    { name: "Reunioes", order: 3, color: "#A29BFE", tenantId: GH_TENANT_ID },
    { name: "Propostas", order: 4, color: "#FFB800", tenantId: GH_TENANT_ID },
    { name: "Follow Up", order: 5, color: "#6C5CE7", tenantId: GH_TENANT_ID },
    { name: "Ganho", order: 6, color: "#00D68F", tenantId: GH_TENANT_ID },
    { name: "Perdido", order: 7, color: "#FF4757", tenantId: GH_TENANT_ID },
  ];

  for (const stage of stages) {
    try {
      await db.insert(pipelineStage).values(stage);
      console.log(`  [OK] Stage: ${stage.name}`);
    } catch {
      console.log(`  [SKIP] Stage: ${stage.name}`);
    }
  }

  // ============================================
  // 5. Kanban columns (se não existirem)
  // ============================================
  console.log("\n--- Kanban Columns ---");
  const columns = [
    { name: "To Do", order: 1, color: "#8B8B9E", tenantId: GH_TENANT_ID },
    { name: "In Progress", order: 2, color: "#FFB800", tenantId: GH_TENANT_ID },
    { name: "Done", order: 3, color: "#00D68F", tenantId: GH_TENANT_ID },
  ];

  for (const col of columns) {
    try {
      await db.insert(kanbanColumn).values(col);
      console.log(`  [OK] Column: ${col.name}`);
    } catch {
      console.log(`  [SKIP] Column: ${col.name}`);
    }
  }

  console.log("\nSeed completed!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
