"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TaskFormData {
  title: string;
  description: string;
  columnId: string;
  assignedTo: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
}

interface Column { id: string; name: string; }
interface TeamUser { id: string; name: string; }

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (task: Record<string, unknown>) => void;
  columns: Column[];
  users: TeamUser[];
  currentUserId: string;
  initialData?: Partial<TaskFormData> & { id?: string };
  mode?: "create" | "edit";
}

const EMPTY: TaskFormData = {
  title: "",
  description: "",
  columnId: "",
  assignedTo: "",
  dueDate: "",
  priority: "medium",
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa", className: "text-success" },
  { value: "medium", label: "Média", className: "text-warning" },
  { value: "high", label: "Alta", className: "text-error" },
  { value: "urgent", label: "Urgente", className: "text-error font-bold" },
];

export function TaskModal({ open, onClose, onSuccess, columns, users, currentUserId, initialData, mode = "create" }: TaskModalProps) {
  const [form, setForm] = useState<TaskFormData>({
    ...EMPTY,
    assignedTo: currentUserId,
    columnId: columns[0]?.id ?? "",
    ...initialData,
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = mode === "edit" && initialData?.id
        ? `/api/kanban/tasks/${initialData.id}`
        : "/api/kanban/tasks";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          columnId: form.columnId,
          assignedTo: form.assignedTo,
          dueDate: form.dueDate || null,
          priority: form.priority,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erro ao salvar");
        return;
      }
      const data = await res.json();
      toast.success(mode === "create" ? "Tarefa criada!" : "Tarefa salva!");
      onSuccess(data.task);
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof TaskFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">{mode === "edit" ? "Editar Tarefa" : "Nova Tarefa"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors cursor-pointer p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-label text-muted block mb-1.5">Título <span className="text-error">*</span></label>
            <input type="text" value={form.title} onChange={set("title")} required
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="Descreva a tarefa..." />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Descrição</label>
            <textarea value={form.description} onChange={set("description")} rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Detalhes adicionais..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Coluna <span className="text-error">*</span></label>
              <Select 
                value={form.columnId} 
                onChange={(val) => setForm((p) => ({ ...p, columnId: val }))}
                options={columns.map(c => ({ value: c.id, label: c.name }))} 
                placeholder="Selecione..." 
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Prioridade</label>
              <Select 
                value={form.priority} 
                onChange={(val) => setForm((p) => ({ ...p, priority: val as any }))}
                options={PRIORITY_OPTIONS} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Responsável <span className="text-error">*</span></label>
              <Select 
                value={form.assignedTo} 
                onChange={(val) => setForm((p) => ({ ...p, assignedTo: val }))}
                options={[{ value: "", label: "Selecionar..." }, ...users.map(u => ({ value: u.id, label: u.name }))]} 
                placeholder="Selecionar..." 
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Prazo</label>
              <input type="date" value={form.dueDate} onChange={set("dueDate")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors text-sm cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
