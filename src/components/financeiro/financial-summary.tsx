"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, Pencil, Check, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  partnerSharePct: number;
  companyReservePct: number;
  partnerCount: number;
  isPartner: boolean;
  revenueGoal: number | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Goal Widget ──────────────────────────────────────────────────────────────

function GoalWidget({ totalIncome, revenueGoal }: { totalIncome: number; revenueGoal: number | null }) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(revenueGoal != null ? String(revenueGoal) : "");
  const [goal, setGoal] = useState(revenueGoal);
  const [saving, setSaving] = useState(false);

  const pct = goal && goal > 0 ? Math.min((totalIncome / goal) * 100, 100) : 0;
  const remaining = goal ? Math.max(goal - totalIncome, 0) : 0;
  const exceeded = goal != null && totalIncome > goal;

  const handleSave = async () => {
    const parsed = parseFloat(inputValue.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/financeiro/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueGoal: parsed }),
      });
      if (res.ok) {
        setGoal(parsed);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(goal != null ? String(goal) : "");
    setEditing(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Meta de Faturamento</p>
            <p className="text-xs text-muted">Mês atual</p>
          </div>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            title="Editar meta"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Salvar"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mb-4">
          <label className="text-xs text-muted mb-1 block">Nova meta (R$)</label>
          <input
            autoFocus
            type="number"
            min="0"
            step="100"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            placeholder="Ex: 10000"
          />
        </div>
      ) : goal == null ? (
        <div className="mb-4 py-3 text-center border border-dashed border-border rounded-lg">
          <p className="text-xs text-muted">Nenhuma meta definida</p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline mt-1 cursor-pointer"
          >
            Definir meta
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-bold text-foreground">{fmt(totalIncome)}</p>
              <p className="text-xs text-muted">de {fmt(goal)}</p>
            </div>
            <span
              className={cn(
                "text-lg font-bold",
                exceeded ? "text-success" : pct >= 75 ? "text-warning" : "text-primary"
              )}
            >
              {pct.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                exceeded ? "bg-success" : pct >= 75 ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted">
            {exceeded ? (
              <span className="text-success font-medium">
                Meta superada em {fmt(totalIncome - goal)} 🎉
              </span>
            ) : (
              <span>Faltam {fmt(remaining)} para atingir a meta</span>
            )}
            <span>{Math.round(pct)}% concluído</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Summary ─────────────────────────────────────────────────────────────

export function FinancialSummary({
  totalIncome,
  totalExpenses,
  partnerSharePct,
  companyReservePct,
  partnerCount,
  isPartner,
  revenueGoal,
}: FinancialSummaryProps) {
  const profit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  const perPartner = profit > 0 ? profit * (partnerSharePct / 100) : 0;
  const companyReserve = profit > 0 ? profit * (companyReservePct / 100) : 0;
  const totalPartnerShare = perPartner * partnerCount;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Receita</p>
          </div>
          <p className="text-2xl font-bold text-success">{fmt(totalIncome)}</p>
        </div>

        {/* Despesas */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-error" />
            </div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Despesas</p>
          </div>
          <p className="text-2xl font-bold text-error">{fmt(totalExpenses)}</p>
        </div>

        {/* Lucro */}
        <div className={cn(
          "bg-surface rounded-xl border p-5",
          profit >= 0 ? "border-success/20" : "border-error/20"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", profit >= 0 ? "bg-success/10" : "bg-error/10")}>
              <DollarSign className={cn("w-4 h-4", profit >= 0 ? "text-success" : "text-error")} />
            </div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Lucro</p>
          </div>
          <p className={cn("text-2xl font-bold", profit >= 0 ? "text-success" : "text-error")}>
            {fmt(profit)}
          </p>
        </div>

        {/* Margem */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Percent className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Margem</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{profitMargin.toFixed(1)}%</p>
          <p className="text-xs text-muted mt-1">Margem de lucro</p>
        </div>
      </div>

      {/* Partner-only row: Meta + Distribuição */}
      {isPartner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GoalWidget totalIncome={totalIncome} revenueGoal={revenueGoal} />

          {/* Distribuição */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Distribuição
                </p>
                <p className="text-xs text-muted">{partnerCount} sócio{partnerCount > 1 ? "s" : ""}</p>
              </div>
            </div>

            {profit <= 0 ? (
              <p className="text-sm text-muted text-center py-4">Sem lucro para distribuir</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted">Por sócio ({partnerSharePct}%)</span>
                    <span className="font-semibold text-success">{fmt(perPartner)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted">Reserva empresa ({companyReservePct}%)</span>
                    <span className="font-semibold text-info">{fmt(companyReserve)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted">Total sócios</span>
                    <span className="font-semibold text-foreground">{fmt(totalPartnerShare)}</span>
                  </div>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden flex">
                  <div className="bg-success h-full" style={{ width: `${Math.min((totalPartnerShare / profit) * 100, 100)}%` }} />
                  <div className="bg-info h-full" style={{ width: `${Math.min((companyReserve / profit) * 100, 100)}%` }} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Sócios</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info inline-block" /> Reserva</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
