import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { contract } from "@/lib/db/schema/contracts";
import { client } from "@/lib/db/schema/clients";
import { lead, pipelineStage } from "@/lib/db/schema/pipeline";
import { financialTransaction } from "@/lib/db/schema/financial";
import { eq, and, gte, lte, desc, count, sum, lt, asc } from "drizzle-orm";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { UserRole } from "@/types";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, getYear } from "date-fns";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canView = await checkPermission(session.user.id, userRole, "dashboard", "view");
  if (!canView) redirect("/");

  const now = new Date();
  const yearNum = getYear(now);

  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const yearStart = format(startOfYear(now), "yyyy-MM-dd");
  const yearEnd = format(endOfYear(now), "yyyy-MM-dd");
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const prevYearStart = format(startOfYear(subYears(now, 1)), "yyyy-MM-dd");
  const prevYearEnd = format(endOfYear(subYears(now, 1)), "yyyy-MM-dd");
  const prevYearSameMonthStart = format(startOfMonth(subYears(now, 1)), "yyyy-MM-dd");
  const prevYearSameMonthEnd = format(endOfMonth(subYears(now, 1)), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const [
    monthIncomeRow,
    monthExpensesRow,
    pendingRow,
    overdueRow,
    yearTotalRow,
    yearReceivedRow,
    yearPendingRow,
    prevYearTotalRow,
    prevMonthIncomeRow,
    prevYearSameMonthRow,
    activeContractsRow,
    recentClients,
    stagesWithLeads,
    clientContracts,
  ] = await Promise.all([
    // Receita paga este mês
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, monthStart), lte(financialTransaction.transactionDate, monthEnd))),

    // Despesas este mês (pagas)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "expense"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, monthStart), lte(financialTransaction.transactionDate, monthEnd))),

    // A receber (income pendente)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "pending"))),

    // Vencidos (income overdue)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "overdue"))),

    // Total income do ano (todas as transações de receita)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"),
        gte(financialTransaction.transactionDate, yearStart), lte(financialTransaction.transactionDate, yearEnd))),

    // Recebido do ano (pagas)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, yearStart), lte(financialTransaction.transactionDate, yearEnd))),

    // A receber do ano (pending + overdue dentro do ano)
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"),
        gte(financialTransaction.transactionDate, yearStart), lte(financialTransaction.transactionDate, yearEnd),
        eq(financialTransaction.status, "pending"))),

    // Total income ano anterior
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, prevYearStart), lte(financialTransaction.transactionDate, prevYearEnd))),

    // Receita mês anterior paga
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, prevMonthStart), lte(financialTransaction.transactionDate, prevMonthEnd))),

    // Mesmo mês ano anterior
    db.select({ total: sum(financialTransaction.amount) }).from(financialTransaction)
      .where(and(eq(financialTransaction.type, "income"), eq(financialTransaction.status, "paid"),
        gte(financialTransaction.transactionDate, prevYearSameMonthStart), lte(financialTransaction.transactionDate, prevYearSameMonthEnd))),

    // Contratos ativos (MRR + count)
    db.select({ mrr: sum(contract.monthlyValue), count: count() }).from(contract)
      .where(eq(contract.status, "active")),

    // Clientes recentes
    db.select({ id: client.id, companyName: client.companyName, responsibleName: client.responsibleName, createdAt: client.createdAt })
      .from(client).orderBy(desc(client.createdAt)).limit(5),

    // Leads por estágio
    db.select({
      stageId: pipelineStage.id,
      stageName: pipelineStage.name,
      stageOrder: pipelineStage.order,
      leadCount: count(lead.id),
    }).from(pipelineStage).leftJoin(lead, eq(lead.stageId, pipelineStage.id))
      .groupBy(pipelineStage.id, pipelineStage.name, pipelineStage.order)
      .orderBy(asc(pipelineStage.order)),

    // Contratos por cliente para concentração
    db.select({ clientId: contract.clientId, mrr: sum(contract.monthlyValue) }).from(contract)
      .where(eq(contract.status, "active")).groupBy(contract.clientId),
  ]);

  // ── Computed values ────────────────────────────────────────────────────────

  const monthIncome = Number(monthIncomeRow[0]?.total ?? 0);
  const monthExpenses = Number(monthExpensesRow[0]?.total ?? 0);
  const monthProfit = monthIncome - monthExpenses;
  const pending = Number(pendingRow[0]?.total ?? 0);
  const overdue = Number(overdueRow[0]?.total ?? 0);

  const yearTotal = Number(yearTotalRow[0]?.total ?? 0);
  const yearReceived = Number(yearReceivedRow[0]?.total ?? 0);
  const yearPending = Number(yearPendingRow[0]?.total ?? 0);

  const prevYearTotal = Number(prevYearTotalRow[0]?.total ?? 0);
  const prevMonthIncome = Number(prevMonthIncomeRow[0]?.total ?? 0);
  const prevYearSameMonth = Number(prevYearSameMonthRow[0]?.total ?? 0);

  const yoyGrowth = prevYearTotal > 0 ? ((yearReceived - prevYearTotal) / prevYearTotal) * 100 : null;
  const momGrowth = prevMonthIncome > 0 ? ((monthIncome - prevMonthIncome) / prevMonthIncome) * 100 : null;
  const vsLastYear = prevYearSameMonth > 0 ? ((monthIncome - prevYearSameMonth) / prevYearSameMonth) * 100 : null;

  const totalMrr = Number(activeContractsRow[0]?.mrr ?? 0);
  const activeContractCount = activeContractsRow[0]?.count ?? 0;
  const ticketMedio = activeContractCount > 0 ? totalMrr / activeContractCount : 0;
  const profitMargin = monthIncome > 0 ? (monthProfit / monthIncome) * 100 : 0;
  const revenuePerHour = monthIncome / 160;

  // Concentração: maior MRR único / total MRR
  const maxClientMrr = clientContracts.length > 0
    ? Math.max(...clientContracts.map((c) => Number(c.mrr ?? 0)))
    : 0;
  const concentration = totalMrr > 0 ? (maxClientMrr / totalMrr) * 100 : 0;

  // Funil — excluir stages sem leads E stages de "ganho/perdido" para o funil operacional
  const FUNNEL_EXCLUDE = ["ganho", "perdido", "won", "lost"];
  const funnelStages = stagesWithLeads
    .filter((s) => !FUNNEL_EXCLUDE.some((x) => s.stageName.toLowerCase().includes(x)))
    .map((s) => ({ name: s.stageName, leads: s.leadCount }));

  const totalLeads = stagesWithLeads.reduce((acc, s) => acc + s.leadCount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 text-foreground">Dashboard</h1>
        <p className="text-muted mt-1">Visão consolidada das operações da Growth Hub</p>
      </div>

      <DashboardClient
        monthly={{ income: monthIncome, expenses: monthExpenses, profit: monthProfit, pending, overdue }}
        yearly={{ total: yearTotal, received: yearReceived, pending: yearPending, year: yearNum, yoyGrowth, momGrowth, vsLastYear }}
        business={{ ticketMedio, momGrowth, revenuePerHour, profitMargin, concentration, totalMrr, activeContracts: activeContractCount }}
        funnelStages={funnelStages}
        totalLeads={totalLeads}
        recentClients={recentClients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      />
    </div>
  );
}
