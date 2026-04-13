import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { contract } from "@/lib/db/schema/contracts";
import { client } from "@/lib/db/schema/clients";
import { financialTransaction } from "@/lib/db/schema/financial";
import { eq, and, ilike, desc } from "drizzle-orm";
import type { UserRole } from "@/types";
import { format } from "date-fns";

const createContractSchema = z.object({
  clientId: z.string().uuid("ID de cliente inválido"),
  companyName: z.string().min(1).max(255),
  monthlyValue: z.coerce.number().min(0).default(0),
  implementationValue: z.coerce.number().min(0).default(0).optional(),
  type: z.enum(["monthly", "annual"]).default("monthly"),
  startDate: z.string().min(1, "Data de início obrigatória"),
  endDate: z.string().optional().nullable(),
  paymentDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  status: z.enum(["active", "expiring", "inactive"]).default("active"),
  driveFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "contracts", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");

    const conditions = [];
    if (search) conditions.push(ilike(contract.companyName, `%${search}%`));
    if (status && ["active", "expiring", "inactive"].includes(status)) {
      conditions.push(eq(contract.status, status));
    }

    const contracts = await db
      .select()
      .from(contract)
      .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined)
      .orderBy(desc(contract.createdAt));

    return NextResponse.json({ contracts });
  } catch {
    console.error("[CONTRACTS] GET failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "contracts", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    const [existingClient] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, data.clientId))
      .limit(1);

    if (!existingClient) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const [newContract] = await db.insert(contract).values({
      clientId: data.clientId,
      companyName: data.companyName,
      monthlyValue: String(data.monthlyValue),
      implementationValue: data.implementationValue != null ? String(data.implementationValue) : "0",
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      paymentDay: data.paymentDay ?? null,
      status: data.status,
      driveFileId: data.driveFileId ?? null,
      notes: data.notes ?? null,
    }).returning();

    // ── Auto-create pending financial transaction for active contracts ────
    if (data.status === "active" && data.monthlyValue > 0) {
      try {
        await createContractTransaction(newContract.id, data.clientId, data.companyName, data.monthlyValue, data.startDate, session.user.id);
      } catch {
        // Best-effort — don't fail contract creation
      }
    }

    return NextResponse.json({ contract: newContract }, { status: 201 });
  } catch {
    console.error("[CONTRACTS] POST failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Creates a pending monthly income transaction for a contract. */
async function createContractTransaction(
  contractId: string,
  clientId: string,
  companyName: string,
  monthlyValue: number,
  startDate: string,
  userId: string
) {
  const now = new Date();
  // Due date: use paymentDay from contract if available, else end of current month
  const transactionDate = format(now, "yyyy-MM-dd");
  const dueDate = startDate > transactionDate ? startDate : transactionDate;

  await db.insert(financialTransaction).values({
    name: `Mensalidade — ${companyName}`,
    type: "income",
    category: "cliente",
    amount: String(monthlyValue),
    transactionDate,
    billingType: "monthly",
    status: "pending",
    dueDate,
    contractId,
    clientId,
    notes: "Criado automaticamente ao ativar contrato.",
    createdBy: userId,
  });
}
