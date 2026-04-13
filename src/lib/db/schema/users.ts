import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenants";

// ============================================
// USER (extended from better-auth defaults)
// ============================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("operational"), // 'partner', 'manager', 'operational'
  jobTitle: text("jobTitle"),
  phone: text("phone"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

// better-auth required tables
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }),
});

// ============================================
// USER ↔ TENANT (junction)
// ============================================

export const userTenant = pgTable(
  "user_tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("operator"), // 'superadmin' | 'admin' | 'operator'
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_user_tenant").on(table.userId, table.tenantId),
    index("idx_user_tenant_user").on(table.userId),
    index("idx_user_tenant_tenant").on(table.tenantId),
  ]
);

// ============================================
// PERMISSIONS
// ============================================

export const modulePermission = pgTable("module_permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // 'dashboard','pipeline','contracts','financial','crm','clients','sdr','kanban','blog','admin'
  canView: boolean("can_view").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Relations
// ============================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  permissions: many(modulePermission),
  tenants: many(userTenant),
}));

export const userTenantRelations = relations(userTenant, ({ one }) => ({
  user: one(user, { fields: [userTenant.userId], references: [user.id] }),
  tenant: one(tenant, { fields: [userTenant.tenantId], references: [tenant.id] }),
}));

// tenantRelations definido aqui (não em tenants.ts) para evitar circular import
export const tenantRelations = relations(tenant, ({ many }) => ({
  userTenants: many(userTenant),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const modulePermissionRelations = relations(modulePermission, ({ one }) => ({
  user: one(user, {
    fields: [modulePermission.userId],
    references: [user.id],
  }),
}));

// ============================================
// GOOGLE INTEGRATION (per-user Calendar OAuth)
// ============================================

export const userGoogleIntegration = pgTable("user_google_integration", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  googleEmail: text("google_email"),
  googleRefreshToken: text("google_refresh_token").notNull(),
  googleCalendarId: text("google_calendar_id").notNull().default("primary"),
  googleAccessToken: text("google_access_token"),
  googleAccessTokenExpiresAt: timestamp("google_access_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userGoogleIntegrationRelations = relations(userGoogleIntegration, ({ one }) => ({
  user: one(user, {
    fields: [userGoogleIntegration.userId],
    references: [user.id],
  }),
}));
