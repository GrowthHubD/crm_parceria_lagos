import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { financialTransaction } from "@/lib/db/schema/financial";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.enum(["infraestrutura", "interno", "educacao", "cliente", "servico", "outro"]).optional(),
  amount: z.coerce.number().positive().optional(),
  transactionDate: z.string().optional(),
  billingType: z.enum(["monthly", "annual", "one_time"]).optional(),
  status: z.enum(["paid", "pending", "overdue"]).optional(),
  dueDate: z.string().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
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
    const canEdit = await checkPermission(session.user.id, userRole, "financial", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) updates.name = d.name;
    if (d.type !== undefined) updates.type = d.type;
    if (d.category !== undefined) updates.category = d.category;
    if (d.amount !== undefined) updates.amount = String(d.amount);
    if (d.transactionDate !== undefined) updates.transactionDate = d.transactionDate;
    if (d.billingType !== undefined) updates.billingType = d.billingType;
    if (d.status !== undefined) updates.status = d.status;
    if (d.dueDate !== undefined) updates.dueDate = d.dueDate;
    if (d.contractId !== undefined) updates.contractId = d.contractId;
    if (d.clientId !== undefined) updates.clientId = d.clientId;
    if (d.notes !== undefined) updates.notes = d.notes;

    const [updated] = await db
      .update(financialTransaction)
      .set(updates)
      .where(eq(financialTransaction.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    return NextResponse.json({ transaction: updated });
  } catch {
    console.error("[FINANCIAL] PATCH failed:", { operation: "update" });
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
    const canDelete = await checkPermission(session.user.id, userRole, "financial", "delete");
    if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [deleted] = await db
      .delete(financialTransaction)
      .where(eq(financialTransaction.id, id))
      .returning({ id: financialTransaction.id });

    if (!deleted) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    console.error("[FINANCIAL] DELETE failed:", { operation: "delete" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
