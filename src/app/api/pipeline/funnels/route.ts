import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { pipeline, pipelineStage } from "@/lib/db/schema/pipeline";
import { eq, asc, and } from "drizzle-orm";
import { getTenantContext } from "@/lib/tenant";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);

    const funnels = await db
      .select()
      .from(pipeline)
      .where(eq(pipeline.tenantId, ctx.tenantId))
      .orderBy(asc(pipeline.createdAt));

    return NextResponse.json({ funnels });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canEdit = await checkPermission(ctx.userId, ctx.role as UserRole, "pipeline", "edit", ctx);
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { name, description } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const [funnel] = await db
      .insert(pipeline)
      .values({
        name: name.trim(),
        description: description || null,
        tenantId: ctx.tenantId,
        isDefault: false,
      })
      .returning();

    // Criar stages padrão para o novo funil
    const defaultStages = [
      { name: "Novo", order: 1, color: "#8B8B9E" },
      { name: "Em Andamento", order: 2, color: "#3B82F6" },
      { name: "Ganho", order: 3, color: "#00D68F" },
      { name: "Perdido", order: 4, color: "#FF4757" },
    ];

    for (const stage of defaultStages) {
      await db.insert(pipelineStage).values({
        ...stage,
        pipelineId: funnel.id,
        tenantId: ctx.tenantId,
        isWon: stage.name === "Ganho",
      });
    }

    return NextResponse.json({ funnel }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
