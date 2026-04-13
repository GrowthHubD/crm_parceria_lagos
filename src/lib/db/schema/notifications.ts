import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { tenant } from "./tenants";

// ============================================
// NOTIFICATIONS
// ============================================

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull(), // 'contract_expiring', 'task_due', 'new_lead', 'payment_overdue', 'system'
    module: text("module"), // Module of origin
    link: text("link"), // Internal URL for navigation
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_user").on(table.userId, table.isRead, table.createdAt),
  ]
);

// ============================================
// Relations
// ============================================

export const notificationRelations = relations(notification, ({ one }) => ({
  tenant: one(tenant, { fields: [notification.tenantId], references: [tenant.id] }),
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
}));
