import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenants";

// ============================================
// SDR AGENT (metrics received via webhook)
// ============================================

export const sdrAgent = pgTable("sdr_agent", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sdrMetricSnapshot = pgTable(
  "sdr_metric_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => sdrAgent.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    leadsProspected: integer("leads_prospected").notNull().default(0),
    newLeads: integer("new_leads").notNull().default(0),
    totalMessagesSent: integer("total_messages_sent").notNull().default(0),
    messagesPerMeeting: numeric("messages_per_meeting", { precision: 8, scale: 2 }).default("0"),
    responseRate: numeric("response_rate", { precision: 5, scale: 2 }).default("0"),
    meetingsScheduled: integer("meetings_scheduled").notNull().default(0),
    meetingsShowRate: numeric("meetings_show_rate", { precision: 5, scale: 2 }).default("0"),
    meetingsNoShow: integer("meetings_no_show").notNull().default(0),
    meetingsRescheduled: integer("meetings_rescheduled").notNull().default(0),
    meetingsCancelled: integer("meetings_cancelled").notNull().default(0),
    leadsRefused: integer("leads_refused").notNull().default(0),
    leadsQualified: integer("leads_qualified").notNull().default(0),
    firstResponseTimeAvgMin: numeric("first_response_time_avg_min", { precision: 8, scale: 2 }).default("0"),
    conversionRate: numeric("conversion_rate", { precision: 5, scale: 2 }).default("0"),
    mrrGenerated: numeric("mrr_generated", { precision: 12, scale: 2 }).default("0"),
    arrGenerated: numeric("arr_generated", { precision: 12, scale: 2 }).default("0"),
    revenueAttributed: numeric("revenue_attributed", { precision: 12, scale: 2 }).default("0"),
    dropoffStageData: jsonb("dropoff_stage_data"), // {"sem_atendimento": 15, "em_atendimento": 8, ...}
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sdr_metric_agent").on(table.agentId),
    index("idx_sdr_metric_period").on(table.periodStart, table.periodEnd),
  ]
);

// ============================================
// Relations
// ============================================

export const sdrAgentRelations = relations(sdrAgent, ({ one, many }) => ({
  tenant: one(tenant, { fields: [sdrAgent.tenantId], references: [tenant.id] }),
  metrics: many(sdrMetricSnapshot),
}));

export const sdrMetricSnapshotRelations = relations(sdrMetricSnapshot, ({ one }) => ({
  agent: one(sdrAgent, {
    fields: [sdrMetricSnapshot.agentId],
    references: [sdrAgent.id],
  }),
}));
