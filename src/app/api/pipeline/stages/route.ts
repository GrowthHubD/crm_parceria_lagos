import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { pipeline, pipelineStage } from "@/lib/db/schema/pipeline";
import { sql, eq, ne, and } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
  if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const { name, color, pipelineId } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!pipelineId) return NextResponse.json({ error: "Pipeline ID obrigatório" }, { status: 400 });

  const tenantId = await getTenantId(request.headers);

  // Valida que o pipeline pertence ao tenant atual (impede inserir stage em pipeline de outro tenant)
  const [pipelineRow] = await db
    .select({ id: pipeline.id })
    .from(pipeline)
    .where(and(eq(pipeline.id, pipelineId), eq(pipeline.tenantId, tenantId)))
    .limit(1);
  if (!pipelineRow) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });

  // Get next order value within this pipeline (já escopado pelo pipelineId, mas defesa em profundidade)
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max("order"), 0)` })
    .from(pipelineStage)
    .where(and(eq(pipelineStage.pipelineId, pipelineId), eq(pipelineStage.tenantId, tenantId)));

  const [stage] = await db
    .insert(pipelineStage)
    .values({ tenantId, name: name.trim(), order: (maxOrder ?? 0) + 1, color: color ?? null, pipelineId })
    .returning();

  return NextResponse.json(stage, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
  if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id, isWon, name, color } = await request.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const tenantId = await getTenantId(request.headers);

  // Only one stage can be the "won" stage — clear others within THIS tenant only
  if (isWon === true) {
    await db
      .update(pipelineStage)
      .set({ isWon: false })
      .where(and(ne(pipelineStage.id, id), eq(pipelineStage.tenantId, tenantId)));
  }

  const updates: Record<string, unknown> = {};
  if (typeof isWon === "boolean") updates.isWon = isWon;
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (color !== undefined) updates.color = color;

  const [updated] = await db
    .update(pipelineStage)
    .set(updates)
    .where(and(eq(pipelineStage.id, id), eq(pipelineStage.tenantId, tenantId)))
    .returning();

  return NextResponse.json(updated);
}
