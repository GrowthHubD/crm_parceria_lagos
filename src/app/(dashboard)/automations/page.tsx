import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { automation, automationStep } from "@/lib/db/schema/automations";
import { pipelineStage } from "@/lib/db/schema/pipeline";
import { eq, asc, desc } from "drizzle-orm";
import type { UserRole } from "@/types";
import { AutomationsList } from "@/components/automations/automations-list";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomationsPage() {
  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  const userRole = tenantCtx.role as UserRole;
  const [canView, canEdit] = await Promise.all([
    checkPermission(tenantCtx.userId, userRole, "automations", "view", tenantCtx),
    checkPermission(tenantCtx.userId, userRole, "automations", "edit", tenantCtx),
  ]);
  if (!canView) redirect("/");

  const [automations, allSteps, stages] = await Promise.all([
    db
      .select()
      .from(automation)
      .where(eq(automation.tenantId, tenantCtx.tenantId))
      .orderBy(desc(automation.createdAt)),
    db.select().from(automationStep).orderBy(asc(automationStep.order)),
    db
      .select({ id: pipelineStage.id, name: pipelineStage.name })
      .from(pipelineStage)
      .where(eq(pipelineStage.tenantId, tenantCtx.tenantId))
      .orderBy(asc(pipelineStage.order)),
  ]);

  const automationsWithSteps = automations.map((a) => ({
    ...a,
    steps: allSteps.filter((s) => s.automationId === a.id),
  }));

  return (
    <AutomationsList
      initialAutomations={automationsWithSteps}
      stages={stages}
      canEdit={canEdit}
    />
  );
}
