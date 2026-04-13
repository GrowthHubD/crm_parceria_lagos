"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { LeadTasks } from "./lead-tasks";

interface LeadFormData {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  stageId: string;
  source: string;
  estimatedValue: string;
  notes: string;
  assignedTo: string;
}

interface Stage {
  id: string;
  name: string;
}

interface TeamUser {
  id: string;
  name: string;
}

interface LeadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (lead: Record<string, unknown>) => void;
  stages: Stage[];
  users: TeamUser[];
  currentUserId?: string;
  initialData?: Partial<LeadFormData> & { id?: string };
  mode?: "create" | "edit";
}

const SOURCE_LABELS: Record<string, string> = {
  sdr_bot: "Bot SDR",
  indicacao: "Indicação",
  inbound: "Inbound",
  outbound: "Outbound",
};

const EMPTY: LeadFormData = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  stageId: "",
  source: "",
  estimatedValue: "",
  notes: "",
  assignedTo: "",
};

export function LeadModal({
  open,
  onClose,
  onSuccess,
  stages,
  users,
  currentUserId,
  initialData,
  mode = "create",
}: LeadModalProps) {
  const [form, setForm] = useState<LeadFormData>({ ...EMPTY, ...initialData });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = mode === "edit" && initialData?.id
        ? `/api/pipeline/leads/${initialData.id}`
        : "/api/pipeline/leads";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName || null,
          email: form.email || null,
          phone: form.phone || null,
          stageId: form.stageId,
          source: form.source || null,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
          notes: form.notes || null,
          assignedTo: form.assignedTo || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao salvar lead");
        return;
      }

      toast.success(mode === "create" ? "Lead criado!" : "Lead salvo!");
      const data = await res.json();
      onSuccess(data.lead);
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof LeadFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">
            {mode === "edit" ? "Editar Lead" : "Novo Lead"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-label text-muted block mb-1.5">
              Nome <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              required
              placeholder="Nome do lead"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Empresa</label>
            <input
              type="text"
              value={form.companyName}
              onChange={set("companyName")}
              placeholder="Empresa do lead"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={set("phone")}
                placeholder="(11) 99999-9999"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Valor Est. (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.estimatedValue}
                onChange={set("estimatedValue")}
                placeholder="0,00"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">
              Etapa <span className="text-error">*</span>
            </label>
            <Select
              value={form.stageId}
              onChange={(val) => setForm((prev) => ({ ...prev, stageId: val }))}
              options={stages.map(s => ({ value: s.id, label: s.name }))}
              placeholder="Selecione a etapa..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Origem</label>
              <Select
                value={form.source}
                onChange={(val) => setForm((prev) => ({ ...prev, source: val }))}
                options={[
                  { value: "", label: "Nenhum" },
                  ...Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v }))
                ]}
                placeholder="Selecionar..."
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Responsável</label>
              <Select
                value={form.assignedTo}
                onChange={(val) => setForm((prev) => ({ ...prev, assignedTo: val }))}
                options={[
                  { value: "", label: "Nenhum" },
                  ...users.map(u => ({ value: u.id, label: u.name }))
                ]}
                placeholder="Nenhum"
              />
            </div>
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Observações</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Notas sobre o lead..."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground/20 transition-colors text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar" : "Criar Lead"}
            </button>
          </div>

          {/* Tarefas vinculadas ao lead (apenas no modo edit) */}
          {mode === "edit" && initialData?.id && currentUserId && (
            <LeadTasks
              leadId={initialData.id}
              users={users}
              currentUserId={currentUserId}
            />
          )}
        </form>
      </div>
    </div>
  );
}
