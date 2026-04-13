import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { financialTransaction } from "@/lib/db/schema/financial";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["income", "expense"]),
  category: z.enum(["infraestrutura", "interno", "educacao", "cliente", "servico", "outro"]),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().min(1),
  billingType: z.enum(["monthly", "annual", "one_time"]).default("monthly"),
  status: z.enum(["paid", "pending", "overdue"]).default("pending"),
  dueDate: z.string().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "financial", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // format: "2025-03"
    const type = searchParams.get("type");

    const conditions = [];
    if (month) {
      const [year, m] = month.split("-").map(Number);
      const start = `${year}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(year, m, 0); // last day of month
      const end = `${year}-${String(m).padStart(2, "0")}-${endDate.getDate()}`;
      conditions.push(gte(financialTransaction.transactionDate, start));
      conditions.push(lte(financialTransaction.transactionDate, end));
    }
    if (type === "income" || type === "expense") {
      conditions.push(eq(financialTransaction.type, type));
    }

    const transactions = await db
      .select()
      .from(financialTransaction)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(financialTransaction.transactionDate));

    return NextResponse.json({ transactions });
  } catch {
    console.error("[FINANCIAL] GET failed:", { operation: "list" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "financial", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const [tx] = await db
      .insert(financialTransaction)
      .values({
        name: d.name,
        type: d.type,
        category: d.category,
        amount: String(d.amount),
        transactionDate: d.transactionDate,
        billingType: d.billingType,
        status: d.status,
        dueDate: d.dueDate ?? null,
        contractId: d.contractId ?? null,
        clientId: d.clientId ?? null,
        notes: d.notes ?? null,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch {
    console.error("[FINANCIAL] POST failed:", { operation: "create" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
