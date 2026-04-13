"use client";

import { useState, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, RefreshCw, CalendarDays } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, isToday } from "date-fns";
import { TaskCard } from "./task-card";
import { TaskModal } from "./task-modal";

interface Task {
  id: string;
  title: string;
  description: string | null;
  columnId: string;
  assignedTo: string;
  assigneeName: string | null;
  dueDate: string | null;
  priority: string;
  isCompleted: boolean;
  order: number;
}

interface Column {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

interface TeamUser {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  initialColumns: Column[];
  initialTasks: Task[];
  users: TeamUser[];
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
}

function KanbanColumnDropzone({
  column, tasks, onAdd, onEdit, onDelete, onToggleComplete, canEdit, canDelete,
}: {
  column: Column;
  tasks: Task[];
  onAdd: (columnId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const incomplete = tasks.filter((t) => !t.isCompleted).length;

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {column.color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />}
          <h3 className="text-sm font-semibold text-foreground">{column.name}</h3>
          <span className="text-xs bg-surface-2 text-muted px-1.5 py-0.5 rounded-md">{incomplete}</span>
        </div>
        {canEdit && (
          <button onClick={() => onAdd(column.id)}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <div ref={setNodeRef}
        className={cn("flex-1 flex flex-col gap-2 min-h-[200px] rounded-xl p-2 bg-surface border border-border transition-colors",
          isOver && "border-primary/50 bg-primary/5")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete}
              onToggleComplete={onToggleComplete} canEdit={canEdit} canDelete={canDelete} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-small text-muted/50">Nenhuma tarefa</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ initialColumns, initialTasks, users, currentUserId, canEdit, canDelete }: KanbanBoardProps) {
  const [columns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "all">("today");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const now = new Date();
  const timeFilteredTasks = tasks.filter((t) => {
    if (timeFilter === "all") return true;
    if (!t.dueDate) return false;
    const due = parseISO(t.dueDate);
    if (timeFilter === "today") return isToday(due);
    if (timeFilter === "week") return isWithinInterval(due, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
    if (timeFilter === "month") return isWithinInterval(due, { start: startOfMonth(now), end: endOfMonth(now) });
    return true;
  });

  const getTasksForColumn = (columnId: string) => timeFilteredTasks.filter((t) => t.columnId === columnId);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, columnId: overColumn.id } : t));
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const activeTask = tasks.find((t) => t.id === activeId);
      if (activeTask && overTask.columnId !== activeTask.columnId) {
        setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, columnId: overTask.columnId } : t));
      }
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const moved = tasks.find((t) => t.id === activeId);
    if (!moved) return;

    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && overTask.columnId === moved.columnId) {
      const col = getTasksForColumn(moved.columnId);
      const oldIdx = col.findIndex((t) => t.id === activeId);
      const newIdx = col.findIndex((t) => t.id === overId);
      if (oldIdx !== newIdx) {
        const reordered = arrayMove(col, oldIdx, newIdx);
        setTasks((prev) => [...prev.filter((t) => t.columnId !== moved.columnId), ...reordered]);
      }
      return;
    }

    await fetch(`/api/kanban/tasks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: moved.columnId }),
    }).catch(() => null);
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, isCompleted: completed } : t));
    await fetch(`/api/kanban/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: completed }),
    }).catch(() => null);
  };

  const handleDelete = (id: string) => setPendingDelete(id);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setPendingDelete(null);
    const res = await fetch(`/api/kanban/tasks/${pendingDelete}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== pendingDelete));
  };

  const handleTaskSaved = useCallback((saved: Record<string, unknown>) => {
    const task = saved as unknown as Task;
    const assigneeName = users.find((u) => u.id === task.assignedTo)?.name ?? null;
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id);
      if (exists) return prev.map((t) => t.id === task.id ? { ...t, ...task, assigneeName } : t);
      return [...prev, { ...task, assigneeName }];
    });
  }, [users]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/kanban");
      if (res.ok) { const d = await res.json(); setTasks(d.tasks); }
    } finally { setRefreshing(false); }
  };

  const totalPending = tasks.filter((t) => !t.isCompleted).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Time filter pills */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          <CalendarDays className="w-4 h-4 text-muted mx-2 shrink-0" />
          {([
            { key: "today", label: "Hoje" },
            { key: "week",  label: "Semana" },
            { key: "month", label: "Mês" },
            { key: "all",   label: "Todos" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                timeFilter === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats + actions */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">
            <strong className="text-foreground">{totalPending}</strong> pendente{totalPending !== 1 ? "s" : ""}
          </p>
          <button onClick={refresh} disabled={refreshing}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          {canEdit && (
            <button onClick={() => { setEditingTask(null); setDefaultColumnId(columns[0]?.id ?? ""); setModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer">
              <Plus className="w-4 h-4" /> Nova Tarefa
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {columns.map((col) => (
              <KanbanColumnDropzone key={col.id} column={col} tasks={getTasksForColumn(col.id)}
                onAdd={(id) => { setEditingTask(null); setDefaultColumnId(id); setModalOpen(true); }}
                onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
                onDelete={handleDelete}
                onToggleComplete={handleToggleComplete}
                canEdit={canEdit} canDelete={canDelete} />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="rotate-2 shadow-lg opacity-95">
                <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} onToggleComplete={() => {}} canEdit={false} canDelete={false} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSuccess={handleTaskSaved}
        columns={columns}
        users={users}
        currentUserId={currentUserId}
        initialData={editingTask
          ? { id: editingTask.id, title: editingTask.title, description: editingTask.description ?? "", columnId: editingTask.columnId, assignedTo: editingTask.assignedTo, dueDate: editingTask.dueDate ?? "", priority: editingTask.priority as "low"|"medium"|"high"|"urgent" }
          : { columnId: defaultColumnId }}
        mode={editingTask ? "edit" : "create"}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir tarefa"
        message="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
