import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { contract } from "@/lib/db/schema/contracts";
import { client } from "@/lib/db/schema/clients";
import { financialTransaction } from "@/lib/db/schema/financial";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "@/types";
import { format } from "date-fns";

const updateContractSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  monthlyValue: z.coerce.number().min(0).optional(),
  implementationValue: z.coerce.number().min(0).optional().nullable(),
  type: z.enum(["monthly", "annual"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  paymentDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  status: z.enum(["active", "expiring", "inactive"]).optional(),
  driveFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "contracts", "view");
    if (!canView) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const tenantId = await getTenantId(request.headers);

    const [contractData] = await db
      .select({
        id: contract.id,
        clientId: contract.clientId,
        companyName: contract.companyName,
        monthlyValue: contract.monthlyValue,
        implementationValue: contract.implementationValue,
        type: contract.type,
        startDate: contract.startDate,
        endDate: contract.endDate,
        paymentDay: contract.paymentDay,
        status: contract.status,
        driveFileId: contract.driveFileId,
        notes: contract.notes,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        clientCompanyName: client.companyName,
        clientResponsibleName: client.responsibleName,
        clientEmail: client.email,
        clientPhone: client.phone,
      })
      .from(contract)
      .leftJoin(client, eq(contract.clientId, client.id))
      .where(and(eq(contract.id, id), eq(contract.tenantId, tenantId)))
      .limit(1);

    if (!contractData) {
      return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ contract: contractData });
  } catch (error) {
    console.error("[CONTRACTS] GET by id failed:", { operation: "get" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "contracts", "edit");
    if (!canEdit) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.companyName !== undefined) updates.companyName = data.companyName;
    if (data.monthlyValue !== undefined) updates.monthlyValue = String(data.monthlyValue);
    if (data.implementationValue !== undefined) updates.implementationValue = data.implementationValue != null ? String(data.implementationValue) : null;
    if (data.type !== undefined) updates.type = data.type;
    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;
    if (data.paymentDay !== undefined) updates.paymentDay = data.paymentDay;
    if (data.status !== undefined) updates.status = data.status;
    if (data.driveFileId !== undefined) updates.driveFileId = data.driveFileId;
    if (data.notes !== undefined) updates.notes = data.notes;

    const tenantId = await getTenantId(request.headers);

    // Fetch current state before update to detect status transition (escopo tenant)
    const [before] = await db
      .select({ status: contract.status, monthlyValue: contract.monthlyValue, clientId: contract.clientId, companyName: contract.companyName, startDate: contract.startDate })
      .from(contract)
      .where(and(eq(contract.id, id), eq(contract.tenantId, tenantId)))
      .limit(1);

    const [updated] = await db
      .update(contract)
      .set(updates)
      .where(and(eq(contract.id, id), eq(contract.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
    }

    // ── Auto-create pending financial transaction when activated ─────────
    const activating = data.status === "active" && before?.status !== "active";
    if (activating) {
      try {
        const monthly = Number(updated.monthlyValue ?? 0);
        if (monthly > 0) {
          const now = new Date();
          const transactionDate = format(now, "yyyy-MM-dd");
          const dueDate = updated.startDate > transactionDate ? updated.startDate : transactionDate;
          await db.insert(financialTransaction).values({
            tenantId,
            name: `Mensalidade — ${updated.companyName}`,
            type: "income",
            category: "cliente",
            amount: String(monthly),
            transactionDate,
            billingType: "monthly",
            status: "pending",
            dueDate,
            contractId: updated.id,
            clientId: updated.clientId,
            notes: "Criado automaticamente ao ativar contrato.",
            createdBy: session.user.id,
          });
        }
      } catch {
        // Best-effort
      }
    }

    return NextResponse.json({ contract: updated });
  } catch (error) {
    console.error("[CONTRACTS] PATCH failed:", { operation: "update" });
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
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canDelete = await checkPermission(session.user.id, userRole, "contracts", "delete");
    if (!canDelete) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const tenantId = await getTenantId(request.headers);
    const [deleted] = await db
      .delete(contract)
      .where(and(eq(contract.id, id), eq(contract.tenantId, tenantId)))
      .returning({ id: contract.id });

    if (!deleted) {
      return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONTRACTS] DELETE failed:", { operation: "delete" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
