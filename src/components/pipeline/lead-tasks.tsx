"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, Circle, CalendarDays, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  isCompleted: boolean;
  assigneeName: string | null;
  columnId: string;
}

interface TeamUser {
  id: string;
  name: string;
}

interface Column {
  id: string;
  name: string;
}

interface LeadTasksProps {
  leadId: string;
  users: TeamUser[];
  currentUserId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-error",
  high: "text-error/70",
  medium: "text-warning",
  low: "text-success",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function LeadTasks({ leadId, users, currentUserId }: LeadTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/kanban?leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setColumns(data.columns);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleComplete = async (taskId: string, current: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !current } : t))
    );
    await fetch(`/api/kanban/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !current }),
    });
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/kanban/tasks/${taskId}`, { method: "DELETE" });
  };

  const handleCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowForm(false);
  };

  return (
    <div className="border-t border-border mt-4 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Tarefas</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Tarefa
        </button>
      </div>

      {showForm && (
        <QuickTaskForm
          leadId={leadId}
          users={users}
          columns={columns}
          currentUserId={currentUserId}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted" />
        </div>
      )}

      {!loading && tasks.length === 0 && !showForm && (
        <p className="text-xs text-muted text-center py-3">
          Nenhuma tarefa vinculada
        </p>
      )}

      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors group"
          >
            <button
              onClick={() => toggleComplete(task.id, task.isCompleted)}
              className="mt-0.5 shrink-0 cursor-pointer"
            >
              {task.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <Circle className="w-4 h-4 text-muted" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-xs font-medium text-foreground",
                  task.isCompleted && "line-through text-muted"
                )}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-xs", PRIORITY_COLORS[task.priority])}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-muted flex items-center gap-0.5">
                    <CalendarDays className="w-3 h-3" />
                    {format(new Date(task.dueDate + "T12:00:00"), "dd/MM", { locale: ptBR })}
                  </span>
                )}
                {task.assigneeName && (
                  <span className="text-xs text-muted">{task.assigneeName}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-error transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick task creation form ────────────────────────────────────────────────

function QuickTaskForm({
  leadId,
  users,
  columns,
  currentUserId,
  onCreated,
  onCancel,
}: {
  leadId: string;
  users: TeamUser[];
  columns: Column[];
  currentUserId: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [syncCalendar, setSyncCalendar] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    try {
      const columnId = columns[0]?.id;
      if (!columnId) {
        toast.error("Nenhuma coluna de tarefa disponível");
        return;
      }

      const res = await fetch("/api/kanban/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          columnId,
          assignedTo,
          dueDate: dueDate || null,
          priority,
          leadId,
          syncCalendar,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assignee = users.find((u) => u.id === assignedTo);
        onCreated({
          ...data.task,
          assigneeName: assignee?.name ?? null,
        });
        toast.success("Tarefa criada!");
      } else {
        toast.error("Erro ao criar tarefa");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface-2 rounded-lg p-3 mb-3 space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da tarefa"
        className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
        >
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      <select
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      {dueDate && (
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={syncCalendar}
            onChange={(e) => setSyncCalendar(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          Adicionar à agenda (Google Calendar)
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 text-xs text-muted border border-border rounded-lg hover:bg-surface transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="flex-1 px-2 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Criar
        </button>
      </div>
    </form>
  );
}
