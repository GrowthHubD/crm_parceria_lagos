"use client";

import { useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { TransactionFormModal } from "./transaction-form-modal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  name: string;
  type: string;
  category: string;
  amount: string;
  transactionDate: string;
  billingType: string;
  status: string;
  dueDate: string | null;
  notes: string | null;
}

interface TransactionListProps {
  initialTransactions: Transaction[];
  canEdit: boolean;
  canDelete: boolean;
  typeFixed?: "income" | "expense";
  onSummaryChange?: (income: number, expenses: number) => void;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-success/10 text-success" },
  pending: { label: "Pendente", className: "bg-warning/10 text-warning" },
  overdue: { label: "Atrasado", className: "bg-error/10 text-error" },
};

const CATEGORY_LABELS: Record<string, string> = {
  infraestrutura: "Infraestrutura",
  interno: "Interno",
  educacao: "Educação",
  cliente: "Cliente",
  servico: "Serviço",
  outro: "Outro",
};

const BILLING_LABELS: Record<string, string> = {
  monthly: "Mensal",
  annual: "Anual",
  one_time: "Único",
};

export function TransactionList({ initialTransactions, canEdit, canDelete, typeFixed, onSummaryChange }: TransactionListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(typeFixed ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = transactions.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || t.type === typeFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchMonth = !monthFilter || t.transactionDate.startsWith(monthFilter);
    return matchSearch && matchType && matchStatus && matchMonth;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const q = monthFilter ? `?month=${monthFilter}` : "";
      const res = await fetch(`/api/financeiro${q}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        const income = data.transactions.filter((t: Transaction) => t.type === "income").reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
        const expenses = data.transactions.filter((t: Transaction) => t.type === "expense").reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
        onSummaryChange?.(income, expenses);
      }
    } finally {
      setLoading(false);
    }
  }, [monthFilter, onSummaryChange]);

  const handleDelete = (id: string) => setPendingDelete(id);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setPendingDelete(null);
    setDeletingId(pendingDelete);
    try {
      const res = await fetch(`/api/financeiro/${pendingDelete}`, { method: "DELETE" });
      if (res.ok) setTransactions((p) => p.filter((t) => t.id !== pendingDelete));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar lançamento..." className="bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary w-48 transition-colors" />
            </div>
            <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer" />
            {!typeFixed && (
              <Select value={typeFilter} onChange={setTypeFilter} className="w-36" options={[
                { value: "all", label: "Todos" },
                { value: "income", label: "Receitas" },
                { value: "expense", label: "Despesas" },
              ]} />
            )}
            <Select value={statusFilter} onChange={setStatusFilter} className="w-40" options={[
              { value: "all", label: "Todos status" },
              { value: "paid", label: "Pagos" },
              { value: "pending", label: "Pendentes" },
              { value: "overdue", label: "Atrasados" },
            ]} />
          </div>
          {canEdit && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer shrink-0">
              <Plus className="w-4 h-4" />
              {typeFixed === "income" ? "Nova Receita" : typeFixed === "expense" ? "Nova Despesa" : "Novo Lançamento"}
            </button>
          )}
        </div>

        <p className="text-small text-muted">
          {filtered.length} lançamento{filtered.length !== 1 ? "s" : ""}
          {loading && <Loader2 className="inline w-3 h-3 animate-spin ml-2" />}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <TrendingUp className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">Nenhum lançamento encontrado</p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Descrição</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden sm:table-cell">Categoria</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden md:table-cell">Data</th>
                    <th className="text-right text-label text-muted px-4 py-3 font-medium">Valor</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Status</th>
                    <th className="text-right text-label text-muted px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((t) => {
                    const isIncome = t.type === "income";
                    const status = STATUS_MAP[t.status] ?? STATUS_MAP.pending;
                    return (
                      <tr key={t.id} className="hover:bg-surface-2 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isIncome
                              ? <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                              : <TrendingDown className="w-3.5 h-3.5 text-error shrink-0" />}
                            <div>
                              <p className="font-medium text-foreground">{t.name}</p>
                              <p className="text-small text-muted">{BILLING_LABELS[t.billingType] ?? t.billingType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted text-sm">
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted text-sm">
                          {format(new Date(t.transactionDate + "T12:00:00"), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-semibold", isIncome ? "text-success" : "text-error")}>
                            {isIncome ? "+" : "-"} R$ {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-1 rounded-md text-xs font-medium", status.className)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button onClick={() => { setEditing(t); setModalOpen(true); }}
                                className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                                className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50">
                                {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <TransactionFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSuccess={refresh}
        initialData={editing
          ? {
              id: editing.id,
              name: editing.name,
              type: editing.type as "income" | "expense",
              category: editing.category,
              amount: editing.amount,
              transactionDate: editing.transactionDate,
              billingType: editing.billingType as "monthly" | "annual" | "one_time",
              status: editing.status as "paid" | "pending" | "overdue",
              dueDate: editing.dueDate ?? "",
              notes: editing.notes ?? "",
            }
          : undefined}
        mode={editing ? "edit" : "create"}
        defaultType={typeFixed}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir lançamento"
        message="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
