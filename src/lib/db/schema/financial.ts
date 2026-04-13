import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { contract } from "./contracts";
import { client } from "./clients";
import { tenant } from "./tenants";

// ============================================
// FINANCIAL
// ============================================

export const financialTransaction = pgTable(
  "financial_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'income', 'expense'
    category: text("category").notNull(), // 'infraestrutura', 'interno', 'educacao', 'cliente', 'servico', 'outro'
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    transactionDate: date("transaction_date").notNull(),
    billingType: text("billing_type").notNull().default("monthly"), // 'monthly', 'annual', 'one_time'
    status: text("status").notNull().default("pending"), // 'paid', 'pending', 'overdue'
    dueDate: date("due_date"),
    contractId: uuid("contract_id").references(() => contract.id),
    clientId: uuid("client_id").references(() => client.id),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_financial_date").on(table.transactionDate),
    index("idx_financial_status").on(table.status),
    index("idx_financial_type").on(table.type),
  ]
);

export const financialConfig = pgTable("financial_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  partnerSharePercentage: numeric("partner_share_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("30.00"),
  companyReservePercentage: numeric("company_reserve_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("10.00"),
  revenueGoal: numeric("revenue_goal", { precision: 12, scale: 2 }),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Relations
// ============================================

export const financialTransactionRelations = relations(financialTransaction, ({ one }) => ({
  tenant: one(tenant, { fields: [financialTransaction.tenantId], references: [tenant.id] }),
  contract: one(contract, {
    fields: [financialTransaction.contractId],
    references: [contract.id],
  }),
  client: one(client, {
    fields: [financialTransaction.clientId],
    references: [client.id],
  }),
  createdByUser: one(user, {
    fields: [financialTransaction.createdBy],
    references: [user.id],
  }),
}));
