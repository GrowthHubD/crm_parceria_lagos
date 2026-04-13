import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { tenant } from "./tenants";

// ============================================
// CLIENTS
// ============================================

export const client = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj").unique(),
  responsibleName: text("responsible_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  groupId: text("group_id"), // WhatsApp group ID
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientFile = pgTable("client_file", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'escopo', 'prd', 'contrato', 'outro'
  driveFileId: text("drive_file_id").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientResponsible = pgTable("client_responsible", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  role: text("role").notNull().default("responsible"), // 'responsible', 'collaborator'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Relations
// ============================================

export const clientRelations = relations(client, ({ one, many }) => ({
  tenant: one(tenant, { fields: [client.tenantId], references: [tenant.id] }),
  files: many(clientFile),
  responsibles: many(clientResponsible),
}));

export const clientFileRelations = relations(clientFile, ({ one }) => ({
  client: one(client, {
    fields: [clientFile.clientId],
    references: [client.id],
  }),
}));

export const clientResponsibleRelations = relations(clientResponsible, ({ one }) => ({
  client: one(client, {
    fields: [clientResponsible.clientId],
    references: [client.id],
  }),
  user: one(user, {
    fields: [clientResponsible.userId],
    references: [user.id],
  }),
}));
