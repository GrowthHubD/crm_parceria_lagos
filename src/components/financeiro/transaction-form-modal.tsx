"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";

interface TxFormData {
  name: string;
  type: "income" | "expense";
  category: string;
  amount: string;
  transactionDate: string;
  billingType: "monthly" | "annual" | "one_time";
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  notes: string;
}

const EMPTY: TxFormData = {
  name: "",
  type: "income",
  category: "cliente",
  amount: "",
  transactionDate: new Date().toISOString().split("T")[0],
  billingType: "monthly",
  status: "pending",
  dueDate: "",
  notes: "",
};

const CATEGORIES = [
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "interno", label: "Interno" },
  { value: "educacao", label: "Educação" },
  { value: "cliente", label: "Cliente" },
  { value: "servico", label: "Serviço" },
  { value: "outro", label: "Outro" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<TxFormData> & { id?: string };
  mode?: "create" | "edit";
  defaultType?: "income" | "expense";
}

export function TransactionFormModal({ open, onClose, onSuccess, initialData, mode = "create", defaultType }: Props) {
  const [form, setForm] = useState<TxFormData>({ ...EMPTY, ...(defaultType ? { type: defaultType } : {}), ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = mode === "edit" && initialData?.id ? `/api/financeiro/${initialData.id}` : "/api/financeiro";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          dueDate: form.dueDate || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof TxFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const setField = (field: keyof TxFormData) => (val: string) =>
    setForm((p) => ({ ...p, [field]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">{mode === "edit" ? "Editar Lançamento" : "Novo Lançamento"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors cursor-pointer p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">{error}</div>}

          <div>
            <label className="text-label text-muted block mb-1.5">Descrição <span className="text-error">*</span></label>
            <input type="text" value={form.name} onChange={set("name")} required
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="Ex: Mensalidade Cliente X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Tipo <span className="text-error">*</span></label>
              <Select value={form.type} onChange={setField("type")} options={[
                { value: "income", label: "Receita" },
                { value: "expense", label: "Despesa" },
              ]} />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Valor (R$) <span className="text-error">*</span></label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Categoria</label>
              <Select value={form.category} onChange={setField("category")} options={CATEGORIES} />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Recorrência</label>
              <Select value={form.billingType} onChange={setField("billingType")} options={[
                { value: "monthly", label: "Mensal" },
                { value: "annual", label: "Anual" },
                { value: "one_time", label: "Único" },
              ]} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Data <span className="text-error">*</span></label>
              <input type="date" value={form.transactionDate} onChange={set("transactionDate")} required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Vencimento</label>
              <input type="date" value={form.dueDate} onChange={set("dueDate")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Status</label>
            <Select value={form.status} onChange={setField("status")} options={[
              { value: "paid", label: "Pago" },
              { value: "pending", label: "Pendente" },
              { value: "overdue", label: "Atrasado" },
            ]} />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Observações</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Notas opcionais..."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors text-sm cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
