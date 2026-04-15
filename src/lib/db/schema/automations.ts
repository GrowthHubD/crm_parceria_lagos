import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenants";
import { lead } from "./pipeline";

// ============================================
// AUTOMATIONS (sequências de follow-up)
// ============================================

export const automation = pgTable("automation", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // 'stage_enter' | 'tag_added' | 'manual'
  triggerConfig: jsonb("trigger_config"), // ex: { stageId: "xxx" } ou { tagId: "xxx" }
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationStep = pgTable(
  "automation_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automation.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    type: text("type").notNull(), // 'send_whatsapp' | 'wait' | 'send_email'
    config: jsonb("config").notNull(), // ex: { message: "Olá {{nome}}", delayMinutes: 60 }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_automation_step_automation").on(table.automationId),
  ]
);

export const automationLog = pgTable(
  "automation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automation.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => lead.id, { onDelete: "set null" }),
    stepId: uuid("step_id").references(() => automationStep.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'skipped'
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_automation_log_status").on(table.status, table.scheduledAt),
    index("idx_automation_log_automation").on(table.automationId),
  ]
);

// ============================================
// Relations
// ============================================

export const automationRelations = relations(automation, ({ one, many }) => ({
  tenant: one(tenant, { fields: [automation.tenantId], references: [tenant.id] }),
  steps: many(automationStep),
  logs: many(automationLog),
}));

export const automationStepRelations = relations(automationStep, ({ one }) => ({
  automation: one(automation, {
    fields: [automationStep.automationId],
    references: [automation.id],
  }),
}));

export const automationLogRelations = relations(automationLog, ({ one }) => ({
  automation: one(automation, {
    fields: [automationLog.automationId],
    references: [automation.id],
  }),
  lead: one(lead, {
    fields: [automationLog.leadId],
    references: [lead.id],
  }),
  step: one(automationStep, {
    fields: [automationLog.stepId],
    references: [automationStep.id],
  }),
}));
