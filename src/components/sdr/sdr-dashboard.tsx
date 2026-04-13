"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, TrendingUp, Calendar, Users, MessageSquare, Target, DollarSign, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Metric {
  id: string;
  agentId: string;
  agentName: string | null;
  periodStart: string;
  periodEnd: string;
  leadsProspected: number;
  newLeads: number;
  totalMessagesSent: number;
  messagesPerMeeting: string;
  responseRate: string;
  meetingsScheduled: number;
  meetingsShowRate: string;
  meetingsNoShow: number;
  meetingsRescheduled: number;
  meetingsCancelled: number;
  leadsRefused: number;
  leadsQualified: number;
  firstResponseTimeAvgMin: string;
  conversionRate: string;
  mrrGenerated: string;
  arrGenerated: string;
  revenueAttributed: string;
  dropoffStageData: Record<string, number> | null;
}

interface SdrDashboardProps {
  agents: Agent[];
  initialMetrics: Metric[];
  canEdit: boolean;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: string | number) => `${Number(v).toFixed(1)}%`;

const DROPOFF_LABELS: Record<string, string> = {
  sem_atendimento: "Sem atendimento",
  em_atendimento: "Em atendimento",
  qualificado: "Qualificado",
  reuniao: "Reunião",
  proposta: "Proposta",
  fechado: "Fechado",
};

export function SdrDashboard({ agents, initialMetrics, canEdit }: SdrDashboardProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const filtered = selectedAgentId === "all"
    ? metrics
    : metrics.filter((m) => m.agentId === selectedAgentId);

  // Aggregate totals from filtered metrics
  const totals = filtered.reduce(
    (acc, m) => ({
      leadsProspected: acc.leadsProspected + m.leadsProspected,
      newLeads: acc.newLeads + m.newLeads,
      totalMessagesSent: acc.totalMessagesSent + m.totalMessagesSent,
      meetingsScheduled: acc.meetingsScheduled + m.meetingsScheduled,
      leadsQualified: acc.leadsQualified + m.leadsQualified,
      mrrGenerated: acc.mrrGenerated + Number(m.mrrGenerated),
      revenueAttributed: acc.revenueAttributed + Number(m.revenueAttributed),
    }),
    {
      leadsProspected: 0,
      newLeads: 0,
      totalMessagesSent: 0,
      meetingsScheduled: 0,
      leadsQualified: 0,
      mrrGenerated: 0,
      revenueAttributed: 0,
    }
  );

  const avgConversion =
    filtered.length > 0
      ? filtered.reduce((s, m) => s + Number(m.conversionRate), 0) / filtered.length
      : 0;
  const avgResponseRate =
    filtered.length > 0
      ? filtered.reduce((s, m) => s + Number(m.responseRate), 0) / filtered.length
      : 0;

  const KPI_CARDS = [
    { title: "Leads Prospectados", value: totals.leadsProspected.toString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { title: "Reuniões Agendadas", value: totals.meetingsScheduled.toString(), icon: Calendar, color: "text-success", bg: "bg-success/10" },
    { title: "Leads Qualificados", value: totals.leadsQualified.toString(), icon: Target, color: "text-info", bg: "bg-info/10" },
    { title: "Taxa de Conversão", value: pct(avgConversion), icon: TrendingUp, color: "text-secondary", bg: "bg-secondary/10" },
    { title: "Taxa de Resposta", value: pct(avgResponseRate), icon: MessageSquare, color: "text-warning", bg: "bg-warning/10" },
    { title: "MRR Gerado", value: fmt(totals.mrrGenerated), icon: DollarSign, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters + actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            options={[
              { value: "all", label: "Todos os agentes" },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Registrar Snapshot
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Bot className="w-12 h-12 text-muted/30 mx-auto mb-3" />
          <p className="text-muted text-sm">Nenhum agente SDR cadastrado.</p>
          {canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 text-primary text-sm hover:underline cursor-pointer"
            >
              Criar primeiro agente
            </button>
          )}
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {KPI_CARDS.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.title} className="bg-surface rounded-xl border border-border p-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", k.bg)}>
                    <Icon className={cn("w-4 h-4", k.color)} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{k.value}</p>
                  <p className="text-label text-muted mt-1">{k.title}</p>
                </div>
              );
            })}
          </div>

          {/* Snapshots table */}
          {filtered.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Clock className="w-12 h-12 text-muted/30 mx-auto mb-3" />
              <p className="text-muted text-sm">Nenhum snapshot registrado para este período.</p>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-h3 text-foreground">Histórico de Snapshots</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-label text-muted px-4 py-3 font-medium">Agente</th>
                      <th className="text-left text-label text-muted px-4 py-3 font-medium">Período</th>
                      <th className="text-right text-label text-muted px-4 py-3 font-medium">Leads</th>
                      <th className="text-right text-label text-muted px-4 py-3 font-medium">Reuniões</th>
                      <th className="text-right text-label text-muted px-4 py-3 font-medium">Qualificados</th>
                      <th className="text-right text-label text-muted px-4 py-3 font-medium hidden md:table-cell">Conversão</th>
                      <th className="text-right text-label text-muted px-4 py-3 font-medium hidden lg:table-cell">MRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium text-foreground">{m.agentName ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted text-sm">
                          {format(new Date(m.periodStart + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                          {" – "}
                          {format(new Date(m.periodEnd + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{m.leadsProspected}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-success font-medium">{m.meetingsScheduled}</span>
                          <span className="text-muted text-xs ml-1">({pct(m.meetingsShowRate)} show)</span>
                        </td>
                        <td className="px-4 py-3 text-right text-info font-medium">{m.leadsQualified}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className={cn("font-medium", Number(m.conversionRate) >= 10 ? "text-success" : "text-warning")}>
                            {pct(m.conversionRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-success font-medium">
                          {fmt(Number(m.mrrGenerated))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-agent breakdown */}
          {agents.filter((a) => a.isActive).map((agent) => {
            const agentMetrics = metrics.filter((m) => m.agentId === agent.id);
            if (agentMetrics.length === 0) return null;
            const latest = agentMetrics[0];
            const dropoff = latest.dropoffStageData as Record<string, number> | null;

            return (
              <div key={agent.id} className="bg-surface rounded-xl border border-border p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-h3 text-foreground">{agent.name}</h3>
                    {agent.description && <p className="text-small text-muted">{agent.description}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-label text-muted">Últ. snapshot</p>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {format(new Date(latest.periodStart + "T12:00:00"), "dd/MM/yy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-muted">Tx. Resposta</p>
                    <p className="text-sm font-medium text-foreground mt-1">{pct(latest.responseRate)}</p>
                  </div>
                  <div>
                    <p className="text-label text-muted">T. médio 1ª resp.</p>
                    <p className="text-sm font-medium text-foreground mt-1">{Number(latest.firstResponseTimeAvgMin).toFixed(0)} min</p>
                  </div>
                  <div>
                    <p className="text-label text-muted">ARR Gerado</p>
                    <p className="text-sm font-medium text-success mt-1">{fmt(Number(latest.arrGenerated))}</p>
                  </div>
                </div>

                {dropoff && Object.keys(dropoff).length > 0 && (
                  <div>
                    <p className="text-label text-muted mb-3">Funil de abandono</p>
                    <div className="space-y-2">
                      {Object.entries(dropoff).map(([stage, count]) => {
                        const total = Math.max(...Object.values(dropoff));
                        const pctW = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <div key={stage} className="flex items-center gap-3">
                            <span className="text-small text-muted w-36 shrink-0">
                              {DROPOFF_LABELS[stage] ?? stage}
                            </span>
                            <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pctW}%` }}
                              />
                            </div>
                            <span className="text-small text-foreground w-8 text-right shrink-0">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Snapshot modal */}
      {modalOpen && (
        <SnapshotModal
          agents={agents}
          onClose={() => setModalOpen(false)}
          onSuccess={(newMetric) => {
            setMetrics((prev) => [newMetric, ...prev]);
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Inline snapshot creation modal ──────────────────────────────────────────

interface SnapshotModalProps {
  agents: Agent[];
  onClose: () => void;
  onSuccess: (metric: Metric) => void;
}

function SnapshotModal({ agents, onClose, onSuccess }: SnapshotModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    agentId: agents[0]?.id ?? "",
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    leadsProspected: 0,
    newLeads: 0,
    totalMessagesSent: 0,
    messagesPerMeeting: 0,
    responseRate: 0,
    meetingsScheduled: 0,
    meetingsShowRate: 0,
    meetingsNoShow: 0,
    meetingsRescheduled: 0,
    meetingsCancelled: 0,
    leadsRefused: 0,
    leadsQualified: 0,
    firstResponseTimeAvgMin: 0,
    conversionRate: 0,
    mrrGenerated: 0,
    arrGenerated: 0,
    revenueAttributed: 0,
  });

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: Number(e.target.value) }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/sdr/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess({ ...data.metric, agentName: agents.find((a) => a.id === form.agentId)?.name ?? null });
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type: "text" | "number" | "date" = "number") => (
    <div>
      <label className="block text-label text-muted mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={
          type === "number"
            ? num(key)
            : (e) => setForm((p) => ({ ...p, [key]: e.target.value }))
        }
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">Registrar Snapshot SDR</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-label text-muted mb-1">Agente</label>
            <Select
              value={form.agentId}
              onChange={(val) => setForm((p) => ({ ...p, agentId: val }))}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field("Início do período", "periodStart", "date")}
            {field("Fim do período", "periodEnd", "date")}
          </div>

          <p className="text-label text-muted border-t border-border pt-3">Prospecção</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field("Leads prospectados", "leadsProspected")}
            {field("Novos leads", "newLeads")}
            {field("Mensagens enviadas", "totalMessagesSent")}
            {field("Taxa de resposta (%)", "responseRate")}
            {field("Tempo 1ª resp. (min)", "firstResponseTimeAvgMin")}
            {field("Msgs/reunião", "messagesPerMeeting")}
          </div>

          <p className="text-label text-muted border-t border-border pt-3">Reuniões</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field("Agendadas", "meetingsScheduled")}
            {field("Show rate (%)", "meetingsShowRate")}
            {field("No-show", "meetingsNoShow")}
            {field("Reagendadas", "meetingsRescheduled")}
            {field("Canceladas", "meetingsCancelled")}
          </div>

          <p className="text-label text-muted border-t border-border pt-3">Qualificação & Receita</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field("Qualificados", "leadsQualified")}
            {field("Recusados", "leadsRefused")}
            {field("Tx. conversão (%)", "conversionRate")}
            {field("MRR gerado (R$)", "mrrGenerated")}
            {field("ARR gerado (R$)", "arrGenerated")}
            {field("Receita atribuída (R$)", "revenueAttributed")}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
