"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import {
  Plus, Search, Pencil, Trash2, ExternalLink,
  FileText, AlertTriangle, Loader2, DollarSign,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { ContractFormModal } from "./contract-form-modal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contract {
  id: string;
  clientId: string;
  companyName: string;
  monthlyValue: string;
  implementationValue: string | null;
  type: string;
  startDate: string;
  endDate: string | null;
  paymentDay: number | null;
  status: string;
  driveFileId: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClientOption {
  id: string;
  companyName: string;
}

interface ContractListProps {
  initialContracts: Contract[];
  clients: ClientOption[];
  canEdit: boolean;
  canDelete: boolean;
}

const STATUS_MAP: Record<string, { label: string; className: string; icon?: React.ElementType }> = {
  active: { label: "Ativo", className: "bg-success/10 text-success" },
  expiring: { label: "A Vencer", className: "bg-warning/10 text-warning", icon: AlertTriangle },
  inactive: { label: "Inativo", className: "bg-muted/20 text-muted" },
};

const TYPE_MAP: Record<string, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

export function ContractList({ initialContracts, clients, canEdit, canDelete }: ContractListProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState(initialContracts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = contracts.filter((c) => {
    const matchSearch = !search || c.companyName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contratos");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = (id: string) => setPendingDelete(id);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setPendingDelete(null);
    setDeletingId(pendingDelete);
    try {
      const res = await fetch(`/api/contratos/${pendingDelete}`, { method: "DELETE" });
      if (res.ok) setContracts((prev) => prev.filter((c) => c.id !== pendingDelete));
    } finally {
      setDeletingId(null);
    }
  };

  const totalMRR = filtered
    .filter((c) => c.status === "active" || c.status === "expiring")
    .reduce((sum, c) => sum + Number(c.monthlyValue), 0);

  return (
    <>
      <div className="space-y-4">
        {/* MRR summary */}
        <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-label text-muted">MRR (contratos filtrados)</p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              R$ {totalMRR.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por empresa..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <Select value={statusFilter} onChange={setStatusFilter} className="w-36" options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "expiring", label: "A Vencer" },
              { value: "inactive", label: "Inativos" },
            ]} />
          </div>

          {canEdit && (
            <button
              onClick={() => { setEditingContract(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato
            </button>
          )}
        </div>

        <p className="text-small text-muted">
          {filtered.length} contrato{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          {loading && <Loader2 className="inline w-3 h-3 animate-spin ml-2" />}
        </p>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <FileText className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">Nenhum contrato encontrado</p>
            {canEdit && (
              <button
                onClick={() => { setEditingContract(null); setModalOpen(true); }}
                className="mt-4 text-primary text-sm hover:underline cursor-pointer"
              >
                Criar primeiro contrato
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Empresa</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden sm:table-cell">Valor Mensal</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden lg:table-cell">Término</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Status</th>
                    <th className="text-right text-label text-muted px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => {
                    const status = STATUS_MAP[c.status] ?? STATUS_MAP.inactive;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={c.id} className="hover:bg-surface-2 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{c.companyName}</p>
                          {c.paymentDay && (
                            <p className="text-small text-muted mt-0.5">Vence dia {c.paymentDay}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="font-medium text-success">
                            R$ {Number(c.monthlyValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          {c.implementationValue && Number(c.implementationValue) > 0 && (
                            <p className="text-small text-muted mt-0.5">
                              + R$ {Number(c.implementationValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} impl.
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted">
                          {TYPE_MAP[c.type] ?? c.type}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted">
                          {c.endDate
                            ? format(new Date(c.endDate), "dd/MM/yyyy")
                            : <span className="text-muted/40">Indeterminado</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 w-fit", status.className)}>
                            {StatusIcon && <StatusIcon className="w-3 h-3" />}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.driveFileId && (
                              <a
                                href={c.driveFileId}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded text-success hover:bg-success/10 transition-colors cursor-pointer"
                                title="Abrir arquivo do contrato"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => router.push(`/contratos/${c.id}`)}
                              className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                              title="Ver detalhes"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => { setEditingContract(c); setModalOpen(true); }}
                                className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                                className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50"
                                title="Excluir"
                              >
                                {deletingId === c.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
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

      <ContractFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingContract(null); }}
        onSuccess={refresh}
        initialData={editingContract
          ? {
              id: editingContract.id,
              clientId: editingContract.clientId,
              companyName: editingContract.companyName,
              monthlyValue: editingContract.monthlyValue,
              implementationValue: editingContract.implementationValue ?? "",
              type: editingContract.type as "monthly" | "annual",
              startDate: editingContract.startDate,
              endDate: editingContract.endDate ?? "",
              paymentDay: editingContract.paymentDay?.toString() ?? "",
              status: editingContract.status as "active" | "expiring" | "inactive",
              notes: editingContract.notes ?? "",
            }
          : undefined}
        mode={editingContract ? "edit" : "create"}
        clients={clients}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir contrato"
        message="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
