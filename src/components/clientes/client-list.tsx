"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  Building2,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientFormModal } from "./client-form-modal";

interface Client {
  id: string;
  companyName: string;
  cnpj: string | null;
  responsibleName: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface ClientListProps {
  initialClients: Client[];
  canEdit: boolean;
  canDelete: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-success/10 text-success" },
  inactive: { label: "Inativo", className: "bg-muted/20 text-muted" },
};

export function ClientList({ initialClients, canEdit, canDelete }: ClientListProps) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.responsibleName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clientes");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients);
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
      const res = await fetch(`/api/clientes/${pendingDelete}`, { method: "DELETE" });
      if (res.ok) setClients((prev) => prev.filter((c) => c.id !== pendingDelete));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por empresa ou contato..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <Select value={statusFilter} onChange={setStatusFilter} className="w-32" options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
            ]} />
          </div>

          {canEdit && (
            <button
              onClick={() => { setEditingClient(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          )}
        </div>

        {/* Summary */}
        <p className="text-small text-muted">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          {loading && <Loader2 className="inline w-3 h-3 animate-spin ml-2" />}
        </p>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <Building2 className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">Nenhum cliente encontrado</p>
            {canEdit && (
              <button
                onClick={() => { setEditingClient(null); setModalOpen(true); }}
                className="mt-4 text-primary text-sm hover:underline cursor-pointer"
              >
                Cadastrar primeiro cliente
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
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden sm:table-cell">Contato</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden md:table-cell">Telefone</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Status</th>
                    <th className="text-right text-label text-muted px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => {
                    const status = STATUS_LABELS[c.status] ?? STATUS_LABELS.inactive;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-surface-2 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{c.companyName}</p>
                            {c.cnpj && (
                              <p className="text-small text-muted mt-0.5">
                                CNPJ: {c.cnpj}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div>
                            <p className="text-foreground">{c.responsibleName}</p>
                            {c.email && (
                              <p className="text-small text-muted mt-0.5 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {c.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted">
                          {c.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-muted/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-1 rounded-md text-xs font-medium", status.className)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => router.push(`/clientes/${c.id}`)}
                              className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                              title="Ver detalhes"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => { setEditingClient(c); setModalOpen(true); }}
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

      <ClientFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClient(null); }}
        onSuccess={refresh}
        initialData={editingClient
          ? {
              id: editingClient.id,
              companyName: editingClient.companyName,
              cnpj: editingClient.cnpj ?? undefined,
              responsibleName: editingClient.responsibleName,
              email: editingClient.email ?? undefined,
              phone: editingClient.phone ?? undefined,
              status: editingClient.status as "active" | "inactive",
              notes: editingClient.notes ?? undefined,
            }
          : undefined}
        mode={editingClient ? "edit" : "create"}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
