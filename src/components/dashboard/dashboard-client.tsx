"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Users, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return fmtBRL(v);
};

function GrowthBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-muted">—</span>;
  const pos = value >= 0;
  return (
    <span className={cn("flex items-center gap-1 text-sm font-semibold", pos ? "text-success" : "text-error")}>
      {pos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {pos ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  monthly: { income: number; expenses: number; profit: number; pending: number; overdue: number };
  yearly: { total: number; received: number; pending: number; year: number; yoyGrowth: number | null; momGrowth: number | null; vsLastYear: number | null };
  business: { ticketMedio: number; momGrowth: number | null; revenuePerHour: number; profitMargin: number; concentration: number; totalMrr: number; activeContracts: number };
  funnelStages: { id: string; name: string; leads: number }[];
  totalLeads: number;
  recentClients: { id: string; companyName: string; responsibleName: string; createdAt: string }[];
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueClass }: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-1 min-w-0">
      <p className="text-label text-muted uppercase tracking-wide truncate">{label}</p>
      <p className={cn("text-xl font-bold text-foreground mt-1 truncate", valueClass)}>{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({ monthly, yearly, business, funnelStages, totalLeads, recentClients }: DashboardClientProps) {

  // ── Metric card helper (right column) ─────────────────────────────────────

  function MetricCard({ label, value, sub, highlight }: {
    label: string; value: string; sub: string; highlight?: "success" | "warning" | "error";
  }) {
    const colorMap = { success: "text-success", warning: "text-warning", error: "text-error" };
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <p className="text-label text-muted">{label}</p>
        <p className={cn("text-2xl font-bold mt-1", highlight ? colorMap[highlight] : "text-foreground")}>{value}</p>
        <p className="text-small text-muted mt-1">{sub}</p>
      </div>
    );
  }

  const profitHighlight = monthly.profit >= 0 ? "success" : "error";
  const concHighlight = business.concentration > 50 ? "error" : business.concentration > 30 ? "warning" : "success";
  const marginHighlight = business.profitMargin >= 40 ? "success" : business.profitMargin >= 20 ? "warning" : "error";

  // Funnel chart: only show stages that have >0 leads or at least have a name
  const funnelData = funnelStages.filter((s) => s.leads > 0 || funnelStages.some((x) => x.leads > 0));

  return (
    <div className="space-y-6">

      {/* ── Row 1: Monthly financials ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Receita (mês)"
          value={fmtBRL(monthly.income)}
        />
        <KpiCard
          label="Despesas (mês)"
          value={fmtBRL(monthly.expenses)}
          valueClass="text-error"
        />
        <KpiCard
          label="Lucro (mês)"
          value={fmtBRL(monthly.profit)}
          valueClass={monthly.profit >= 0 ? "text-success" : "text-error"}
        />
        <KpiCard
          label="A Receber"
          value={fmtBRL(monthly.pending)}
          valueClass="text-warning"
        />
        <KpiCard
          label="Vencidos"
          value={fmtBRL(monthly.overdue)}
          valueClass={monthly.overdue > 0 ? "text-error" : "text-foreground"}
          sub={monthly.overdue > 0 ? (
            <span className="flex items-center gap-1 text-xs text-error">
              <AlertTriangle className="w-3 h-3" /> Requer atenção
            </span>
          ) : undefined}
        />
      </div>

      {/* ── Row 2: Yearly financials ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label={`Total ${yearly.year}`}
          value={fmtBRL(yearly.total)}
        />
        <KpiCard
          label={`Recebido ${yearly.year}`}
          value={fmtBRL(yearly.received)}
          valueClass="text-success"
        />
        <KpiCard
          label={`A receber ${yearly.year}`}
          value={fmtBRL(yearly.pending)}
          valueClass="text-warning"
        />
        <KpiCard
          label="Crescimento YOY"
          value={yearly.yoyGrowth !== null ? `${yearly.yoyGrowth >= 0 ? "+" : ""}${yearly.yoyGrowth.toFixed(1)}%` : "—"}
          valueClass={yearly.yoyGrowth === null ? "text-muted" : yearly.yoyGrowth >= 0 ? "text-success" : "text-error"}
          sub={<GrowthBadge value={yearly.yoyGrowth} />}
        />
        <KpiCard
          label="Mensal vs Ano Anterior"
          value={yearly.vsLastYear !== null ? `${yearly.vsLastYear >= 0 ? "+" : ""}${yearly.vsLastYear.toFixed(1)}%` : "—"}
          valueClass={yearly.vsLastYear === null ? "text-muted" : yearly.vsLastYear >= 0 ? "text-success" : "text-error"}
          sub={<GrowthBadge value={yearly.vsLastYear} />}
        />
      </div>

      {/* ── Funil de Prospecção ── */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-h3 text-foreground">Funil de Prospecção</h2>
            <p className="text-small text-muted mt-0.5">Acompanhamento operacional (prospecção fria).</p>
          </div>
          <span className="text-sm text-muted font-medium">{totalLeads} lead{totalLeads !== 1 ? "s" : ""}</span>
        </div>

        {funnelStages.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-muted text-sm">Nenhum estágio de pipeline cadastrado.</p>
          </div>
        ) : (
          <>
            {/* Stage count badges */}
            <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(funnelStages.length, 6)}, minmax(0, 1fr))` }}>
              {funnelStages.map((s) => (
                <div key={s.id} className="bg-surface-2 rounded-lg p-3 text-center">
                  <p className="text-label text-muted truncate">{s.name}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{s.leads}</p>
                </div>
              ))}
            </div>

            {/* Area chart */}
            {funnelData.some((s) => s.leads > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={funnelData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8B8B9E" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8B8B9E" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1A1A24", border: "1px solid #2E2E42", borderRadius: "8px", fontSize: 12 }}
                    labelStyle={{ color: "#F5F5F7" }}
                    itemStyle={{ color: "#8B8B9E" }}
                    formatter={(v: number) => [v, "Leads"]}
                  />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#6C5CE7" fill="url(#funnelGrad)" strokeWidth={2} dot={{ fill: "#6C5CE7", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted text-sm">Nenhum lead no pipeline ainda.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bottom row: Clientes Recentes + Métricas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

        {/* Clientes Recentes */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted" />
            <h2 className="text-h3 text-foreground">Clientes Recentes</h2>
          </div>
          {recentClients.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-muted text-sm">Nenhum cliente cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {recentClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 hover:bg-surface-2 px-2 -mx-2 rounded-lg transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.companyName}</p>
                    <p className="text-small text-muted mt-0.5">Responsável: {c.responsibleName}</p>
                  </div>
                  <p className="text-small text-muted shrink-0 ml-3">
                    {format(new Date(c.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Métricas de negócio */}
        <div className="grid grid-cols-2 gap-3 content-start">
          <MetricCard
            label="Ticket Médio"
            value={fmtBRL(business.ticketMedio)}
            sub="Contratos ativos"
          />
          <MetricCard
            label="Churn"
            value={business.activeContracts > 0 ? "—" : "0%"}
            sub="Taxa de cancelamento"
          />
          <MetricCard
            label="Comparativo mensal"
            value={business.momGrowth !== null ? `${business.momGrowth >= 0 ? "+" : ""}${business.momGrowth.toFixed(1)}%` : "—"}
            sub="vs mês anterior (faturamento geral)"
            highlight={business.momGrowth === null ? undefined : business.momGrowth >= 0 ? "success" : "error"}
          />
          <MetricCard
            label="Margem de lucro"
            value={`${business.profitMargin.toFixed(1)}%`}
            sub="Meta ideal: 20-40%"
            highlight={marginHighlight}
          />
          <MetricCard
            label="Receita por hora"
            value={fmtBRL(business.revenuePerHour)}
            sub="Produtividade mensal (160h)"
          />
          <MetricCard
            label="Concentração de receita"
            value={`${business.concentration.toFixed(1)}%`}
            sub={business.concentration > 30 ? "Risco alto (>30%)" : "Diversificado"}
            highlight={concHighlight}
          />
        </div>
      </div>
    </div>
  );
}
