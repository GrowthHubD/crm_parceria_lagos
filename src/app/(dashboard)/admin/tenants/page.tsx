import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { tenant } from "@/lib/db/schema/tenants";
import type { UserRole } from "@/types";
import { Building2 } from "lucide-react";

export const metadata: Metadata = { title: "Gestão de Tenants" };

export default async function TenantsPage() {
  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  const hasPermission = await checkPermission(
    tenantCtx.userId,
    tenantCtx.role as UserRole,
    "tenants",
    "view",
    tenantCtx
  );
  if (!hasPermission) redirect("/");

  const tenants = await db.select().from(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão de Tenants</h1>
        <p className="text-muted mt-1">
          Gerencie os tenants da plataforma Growth Hub
        </p>
      </div>

      <div className="grid gap-4">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-label text-muted">{t.slug}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {t.isPlatformOwner && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                  Platform Owner
                </span>
              )}
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  t.status === "active"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                {t.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
