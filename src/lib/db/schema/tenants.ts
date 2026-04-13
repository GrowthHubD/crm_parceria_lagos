import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// ============================================
// TENANT
// ============================================
// Relations definidas em users.ts para evitar circular import

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isPlatformOwner: boolean("is_platform_owner").notNull().default(false),
  status: text("status").notNull().default("active"), // 'active' | 'suspended' | 'inactive'
  uazapiInstanceId: text("uazapi_instance_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
