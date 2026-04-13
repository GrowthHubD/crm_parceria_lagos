import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { client } from "@/lib/db/schema/clients";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateLeadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  stageId: z.string().uuid().optional(),
  source: z.enum(["sdr_bot", "indicacao", "inbound", "outbound"]).optional().nullable(),
  estimatedValue: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = updateLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.companyName !== undefined) updates.companyName = data.companyName;
    if (data.email !== undefined) updates.email = data.email || null;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.stageId !== undefined) {
      updates.stageId = data.stageId;
      updates.enteredStageAt = new Date();
    }
    if (data.source !== undefined) updates.source = data.source;
    if (data.estimatedValue !== undefined) updates.estimatedValue = data.estimatedValue != null ? String(data.estimatedValue) : null;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.assignedTo !== undefined) updates.assignedTo = data.assignedTo;

    const [updated] = await db
      .update(lead)
      .set(updates)
      .where(eq(lead.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    // ── Auto-create client when lead moves to a "won" stage ──────────────
    if (data.stageId) {
      try {
        const [stage] = await db
          .select({ isWon: pipelineStage.isWon })
          .from(pipelineStage)
          .where(eq(pipelineStage.id, data.stageId))
          .limit(1);

        if (stage?.isWon && !updated.isConverted) {
          // Marcar lead como convertido
          await db.update(lead).set({ isConverted: true }).where(eq(lead.id, id));
          const companyName = updated.companyName || updated.name;
          const email = updated.email || null;

          // Avoid duplicate: check by companyName + email
          const existing = await db
            .select({ id: client.id })
            .from(client)
            .where(eq(client.companyName, companyName))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(client).values({
              companyName,
              responsibleName: updated.name,
              email,
              phone: updated.phone ?? null,
              status: "active",
              notes: updated.notes ?? null,
            });
          }
        }
      } catch {
        // Auto-create is best-effort — don't fail the lead update
      }
    }

    return NextResponse.json({ lead: updated });
  } catch (error) {
    console.error("[PIPELINE] PATCH lead failed:", { operation: "update_lead" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canDelete = await checkPermission(session.user.id, userRole, "pipeline", "delete");
    if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [deleted] = await db
      .delete(lead)
      .where(eq(lead.id, id))
      .returning({ id: lead.id });

    if (!deleted) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PIPELINE] DELETE lead failed:", { operation: "delete_lead" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
