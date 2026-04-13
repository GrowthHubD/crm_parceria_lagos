import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { CheckSquare } from "lucide-react";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TasksPage() {
  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  const hasPermission = await checkPermission(
    tenantCtx.userId,
    tenantCtx.role as UserRole,
    "tasks",
    "view",
    tenantCtx
  );
  if (!hasPermission) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
        <p className="text-muted mt-1">
          Tarefas vinculadas a leads e acompanhamento de atividades
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-border">
        <CheckSquare className="w-12 h-12 text-muted mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Em breve</h2>
        <p className="text-muted text-sm mt-1 max-w-md text-center">
          Gerencie tarefas vinculadas aos seus leads. Defina prazos,
          responsáveis e acompanhe o progresso de cada atividade.
        </p>
      </div>
    </div>
  );
}
