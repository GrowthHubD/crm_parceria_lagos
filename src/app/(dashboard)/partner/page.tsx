import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenantContext, canManagePartnerClients } from "@/lib/tenant";
import { db } from "@/lib/db";
import { tenant } from "@/lib/db/schema/tenants";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { user, userTenant } from "@/lib/db/schema/users";
import { eq, desc, and } from "drizzle-orm";
import { PartnerClientsManager } from "@/components/partner/clients-manager";

export const metadata: Metadata = { title: "Meus Clientes" };

export default async function PartnerPage() {
  let ctx;
  try {
    ctx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  if (!canManagePartnerClients(ctx)) {
    redirect("/");
  }

  // Lista clientes do parceiro (ou todos, se superadmin).
  // partner_admin/manager: clientes cujo partner_id = tenant atual.
  const whereClause =
    ctx.role === "superadmin" ? undefined : eq(tenant.partnerId, ctx.tenantId);

  const baseQuery = db
    .select({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      billingStatus: tenant.billingStatus,
      billingEmail: tenant.billingEmail,
      createdAt: tenant.createdAt,
      whatsappActive: whatsappNumber.isActive,
      whatsappPhone: whatsappNumber.phoneNumber,
      adminEmail: user.email,
      adminName: user.name,
    })
    .from(tenant)
    .leftJoin(whatsappNumber, eq(whatsappNumber.tenantId, tenant.id))
    .leftJoin(
      userTenant,
      and(eq(userTenant.tenantId, tenant.id), eq(userTenant.role, "admin"))
    )
    .leftJoin(user, eq(user.id, userTenant.userId))
    .orderBy(desc(tenant.createdAt));

  const clientsRaw = whereClause
    ? await baseQuery.where(whereClause)
    : await baseQuery;

  // Dedup: o join com userTenant pode multiplicar linhas se houver mais de
  // um admin por tenant. Pega o primeiro admin de cada tenant.
  const seen = new Set<string>();
  const clients = clientsRaw.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  const serialized = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-foreground">Meus Clientes</h1>
        <p className="text-muted mt-1">
          Gerencie os clientes que você revende · {serialized.length} ativo{serialized.length !== 1 ? "s" : ""}
        </p>
      </div>

      <PartnerClientsManager initialClients={serialized} />
    </div>
  );
}
