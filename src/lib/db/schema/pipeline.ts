import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { tenant } from "./tenants";

// ============================================
// PIPELINE (multi-funil por tenant)
// ============================================

export const pipeline = pgTable("pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// STAGES / LEADS
// ============================================

export const pipelineStage = pgTable("pipeline_stage", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  pipelineId: uuid("pipeline_id").notNull().references(() => pipeline.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color"),
  isWon: boolean("is_won").notNull().default(false),
  welcomeMessage: text("welcome_message"), // mensagem auto ao lead entrar nesse stage
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lead = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStage.id),
    source: text("source"), // 'sdr_bot', 'indicacao', 'inbound', 'outbound'
    estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
    notes: text("notes"),
    assignedTo: text("assigned_to").references(() => user.id),
    crmConversationId: uuid("crm_conversation_id"),
    pushName: text("push_name"), // nome do WhatsApp
    enteredStageAt: timestamp("entered_stage_at", { withTimezone: true }).defaultNow(),
    isConverted: boolean("is_converted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_lead_stage").on(table.stageId),
  ]
);

export const leadTag = pgTable("lead_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadTagAssignment = pgTable(
  "lead_tag_assignment",
  {
    leadId: uuid("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => leadTag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.leadId, table.tagId] }),
  ]
);

// ============================================
// Relations
// ============================================

export const pipelineRelations = relations(pipeline, ({ one, many }) => ({
  tenant: one(tenant, { fields: [pipeline.tenantId], references: [tenant.id] }),
  stages: many(pipelineStage),
}));

export const pipelineStageRelations = relations(pipelineStage, ({ one, many }) => ({
  tenant: one(tenant, { fields: [pipelineStage.tenantId], references: [tenant.id] }),
  pipeline: one(pipeline, { fields: [pipelineStage.pipelineId], references: [pipeline.id] }),
  leads: many(lead),
}));

export const leadRelations = relations(lead, ({ one, many }) => ({
  tenant: one(tenant, { fields: [lead.tenantId], references: [tenant.id] }),
  stage: one(pipelineStage, {
    fields: [lead.stageId],
    references: [pipelineStage.id],
  }),
  assignee: one(user, {
    fields: [lead.assignedTo],
    references: [user.id],
  }),
  tags: many(leadTagAssignment),
}));

export const leadTagAssignmentRelations = relations(leadTagAssignment, ({ one }) => ({
  lead: one(lead, {
    fields: [leadTagAssignment.leadId],
    references: [lead.id],
  }),
  tag: one(leadTag, {
    fields: [leadTagAssignment.tagId],
    references: [leadTag.id],
  }),
}));
