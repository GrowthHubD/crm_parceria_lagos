import { pgTable, text, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenants";

// ============================================
// MESSAGE TEMPLATES
// ============================================
// Editable via /configuracoes (partner only).
// Each row maps to one notification type per tenant.
// Supported variable placeholders:
//   daily_reminder  : {{nome}} {{data}} {{qtd}} {{tarefas}}
//   weekly_digest   : {{nome}} {{semana}} {{qtd}} {{tarefas}}
//   contract_alert  : {{qtd}} {{contratos}}

export const messageTemplate = pgTable(
  "message_template",
  {
    id: text("id").notNull(), // 'daily_reminder' | 'weekly_digest' | 'contract_alert'
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    body: text("body").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    unique("uq_template_tenant").on(table.id, table.tenantId),
  ]
);

// ============================================
// Relations
// ============================================

export const messageTemplateRelations = relations(messageTemplate, ({ one }) => ({
  tenant: one(tenant, { fields: [messageTemplate.tenantId], references: [tenant.id] }),
}));
