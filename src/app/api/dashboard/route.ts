import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { contract } from "@/lib/db/schema/contracts";
import { client } from "@/lib/db/schema/clients";
import { lead } from "@/lib/db/schema/pipeline";
import { financialTransaction } from "@/lib/db/schema/financial";
import { notification } from "@/lib/db/schema/notifications";
import { eq, and, gte, lte, desc, count, sum } from "drizzle-orm";
import type { UserRole } from "@/types";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "dashboard", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const tenantId = await getTenantId(request.headers);
    const now = new Date();

    // --- KPI queries in parallel ---
    const [
      activeContracts,
      expiringContracts,
      activeClients,
      totalLeads,
      recentNotifications,
    ] = await Promise.all([
      db
        .select({
          mrr: sum(contract.monthlyValue),
          count: count(),
        })
        .from(contract)
        .where(eq(contract.status, "active")),

      db
        .select({ count: count() })
        .from(contract)
        .where(eq(contract.status, "expiring")),

      db
        .select({ count: count() })
        .from(client)
        .where(eq(client.status, "active")),

      db
        .select({ count: count() })
        .from(lead),

      db
        .select()
        .from(notification)
        .where(eq(notification.userId, session.user.id))
        .orderBy(desc(notification.createdAt))
        .limit(5),
    ]);

    // --- Revenue trend: last 6 months ---
    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      months.push({
        label: format(d, "MMM/yy", { locale: undefined }),
        start: format(startOfMonth(d), "yyyy-MM-dd"),
        end: format(endOfMonth(d), "yyyy-MM-dd"),
      });
    }

    const revenueTrend = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [inc] = await db
          .select({ total: sum(financialTransaction.amount) })
          .from(financialTransaction)
          .where(
            and(
              eq(financialTransaction.tenantId, tenantId),
              eq(financialTransaction.type, "income"),
              gte(financialTransaction.transactionDate, start),
              lte(financialTransaction.transactionDate, end)
            )
          );
        const [exp] = await db
          .select({ total: sum(financialTransaction.amount) })
          .from(financialTransaction)
          .where(
            and(
              eq(financialTransaction.tenantId, tenantId),
              eq(financialTransaction.type, "expense"),
              gte(financialTransaction.transactionDate, start),
              lte(financialTransaction.transactionDate, end)
            )
          );
        return {
          month: label,
          receita: Number(inc?.total ?? 0),
          despesas: Number(exp?.total ?? 0),
        };
      })
    );

    // Current month leads count (week by week is too expensive — just do this month total)
    const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const [newLeadsThisMonth] = await db
      .select({ count: count() })
      .from(lead)
      .where(gte(lead.createdAt, new Date(thisMonthStart)));

    return NextResponse.json({
      kpis: {
        mrr: Number(activeContracts[0]?.mrr ?? 0),
        activeContracts: activeContracts[0]?.count ?? 0,
        expiringContracts: expiringContracts[0]?.count ?? 0,
        activeClients: activeClients[0]?.count ?? 0,
        totalLeads: totalLeads[0]?.count ?? 0,
        newLeadsThisMonth: newLeadsThisMonth?.count ?? 0,
      },
      revenueTrend,
      recentNotifications: recentNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        module: n.module,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[DASHBOARD] GET failed:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
