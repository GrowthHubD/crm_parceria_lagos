import { eq, and } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { userTenant } from "./db/schema/users";
import { tenant } from "./db/schema/tenants";
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  isPlatformOwner: boolean;
  role: string; // role do user neste tenant: 'superadmin' | 'admin' | 'operator'
  userId: string;
}

/**
 * Extrai o tenant context da request.
 *
 * Estratégia de resolução (em ordem):
 * 1. Header X-Tenant-Id (superadmin cross-tenant override)
 * 2. Tenant padrão do user (isDefault = true em user_tenant)
 *
 * Lança erro se não houver sessão ou tenant válido.
 */
export async function getTenantContext(
  headers: ReadonlyHeaders
): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("UNAUTHENTICATED");

  const tenantOverride = headers.get("x-tenant-id");

  const [row] = await db
    .select({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isPlatformOwner: tenant.isPlatformOwner,
      role: userTenant.role,
    })
    .from(userTenant)
    .innerJoin(tenant, eq(userTenant.tenantId, tenant.id))
    .where(
      tenantOverride
        ? and(
            eq(userTenant.userId, session.user.id),
            eq(tenant.id, tenantOverride)
          )
        : and(
            eq(userTenant.userId, session.user.id),
            eq(userTenant.isDefault, true)
          )
    )
    .limit(1);

  if (!row) throw new Error("NO_TENANT_ACCESS");

  return {
    tenantId: row.tenantId,
    tenantSlug: row.tenantSlug,
    isPlatformOwner: row.isPlatformOwner,
    role: row.role,
    userId: session.user.id,
  };
}

/**
 * Helper simplificado quando só precisa do tenantId.
 */
export async function getTenantId(headers: ReadonlyHeaders): Promise<string> {
  const ctx = await getTenantContext(headers);
  return ctx.tenantId;
}
