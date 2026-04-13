import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { Zap } from "lucide-react";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomationsPage() {
  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  const hasPermission = await checkPermission(
    tenantCtx.userId,
    tenantCtx.role as UserRole,
    "automations",
    "view",
    tenantCtx
  );
  if (!hasPermission) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automações</h1>
        <p className="text-muted mt-1">
          Sequências de follow-up automáticas via WhatsApp
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-border">
        <Zap className="w-12 h-12 text-muted mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Em breve</h2>
        <p className="text-muted text-sm mt-1 max-w-md text-center">
          Configure sequências automáticas de mensagens para follow-up de leads.
          Defina triggers, delays e templates de mensagem.
        </p>
      </div>
    </div>
  );
}
