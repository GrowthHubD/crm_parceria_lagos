import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "@/types";

const createLeadSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(255),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  stageId: z.string().uuid("Etapa inválida"),
  source: z.enum(["sdr_bot", "indicacao", "inbound", "outbound"]).optional().nullable(),
  estimatedValue: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
    if (!canEdit) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const tenantId = await getTenantId(request.headers);

    // Validate stage exists AND belongs to current tenant (impede colocar lead em stage de outro tenant)
    const [stage] = await db
      .select({ id: pipelineStage.id })
      .from(pipelineStage)
      .where(and(eq(pipelineStage.id, data.stageId), eq(pipelineStage.tenantId, tenantId)))
      .limit(1);

    if (!stage) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
    }

    const [newLead] = await db
      .insert(lead)
      .values({
        tenantId,
        name: data.name,
        companyName: data.companyName ?? null,
        email: data.email || null,
        phone: data.phone ?? null,
        stageId: data.stageId,
        source: data.source ?? null,
        estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
        notes: data.notes ?? null,
        assignedTo: data.assignedTo ?? null,
      })
      .returning();

    return NextResponse.json({ lead: newLead }, { status: 201 });
  } catch (error) {
    console.error("[PIPELINE] POST lead failed:", { operation: "create_lead" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
