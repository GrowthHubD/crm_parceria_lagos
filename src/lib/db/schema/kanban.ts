import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { tenant } from "./tenants";
import { lead } from "./pipeline";

// ============================================
// KANBAN / TASKS
// ============================================

export const kanbanColumn = pgTable("kanban_column", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kanbanTask = pgTable(
  "kanban_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => lead.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    columnId: uuid("column_id")
      .notNull()
      .references(() => kanbanColumn.id),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => user.id),
    dueDate: date("due_date"),
    priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    order: integer("order").notNull().default(0),
    whatsappSent: boolean("whatsapp_sent").notNull().default(false),
    googleCalendarEventId: text("google_calendar_event_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_kanban_assigned").on(table.assignedTo),
    index("idx_kanban_due_date").on(table.dueDate),
    index("idx_kanban_column").on(table.columnId),
  ]
);

// ============================================
// Relations
// ============================================

export const kanbanColumnRelations = relations(kanbanColumn, ({ one, many }) => ({
  tenant: one(tenant, { fields: [kanbanColumn.tenantId], references: [tenant.id] }),
  tasks: many(kanbanTask),
}));

export const kanbanTaskRelations = relations(kanbanTask, ({ one }) => ({
  column: one(kanbanColumn, {
    fields: [kanbanTask.columnId],
    references: [kanbanColumn.id],
  }),
  lead: one(lead, {
    fields: [kanbanTask.leadId],
    references: [lead.id],
  }),
  assignee: one(user, {
    fields: [kanbanTask.assignedTo],
    references: [user.id],
    relationName: "assignedTasks",
  }),
  creator: one(user, {
    fields: [kanbanTask.createdBy],
    references: [user.id],
    relationName: "createdTasks",
  }),
}));
