import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  date,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { client } from "./clients";
import { tenant } from "./tenants";

// ============================================
// CONTRACTS
// ============================================

export const contract = pgTable(
  "contract",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    companyName: text("company_name").notNull(), // Denormalized for dashboard performance
    monthlyValue: numeric("monthly_value", { precision: 12, scale: 2 }).notNull().default("0"),
    implementationValue: numeric("implementation_value", { precision: 12, scale: 2 }).default("0"),
    type: text("type").notNull().default("monthly"), // 'monthly', 'annual'
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    paymentDay: integer("payment_day"),
    status: text("status").notNull().default("active"), // 'active', 'expiring', 'inactive'
    driveFileId: text("drive_file_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contract_status").on(table.status),
    index("idx_contract_end_date").on(table.endDate),
    index("idx_contract_client").on(table.clientId),
  ]
);

// ============================================
// Relations
// ============================================

export const contractRelations = relations(contract, ({ one }) => ({
  tenant: one(tenant, { fields: [contract.tenantId], references: [tenant.id] }),
  client: one(client, {
    fields: [contract.clientId],
    references: [client.id],
  }),
}));
