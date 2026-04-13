"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";

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

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-error animate-pulse",
  high: "bg-error",
  medium: "bg-warning",
  low: "bg-success",
};

export function TaskCard({ task, onEdit, onDelete, onToggleComplete, canEdit, canDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const dueDateObj = task.dueDate ? new Date(task.dueDate + "T12:00:00") : null;
  const isOverdue = dueDateObj && !task.isCompleted && isPast(dueDateObj) && !isToday(dueDateObj);
  const isDueToday = dueDateObj && isToday(dueDateObj);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-surface-2 border border-border rounded-lg p-3 group transition-all duration-300",
        "hover:border-primary/50 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]",
        isDragging && "opacity-40",
        task.isCompleted && "opacity-60",
        isOverdue && "border-error/40"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 text-muted hover:text-foreground cursor-grab active:cursor-grabbing transition-colors shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button
              onClick={() => onToggleComplete(task.id, !task.isCompleted)}
              className={cn(
                "mt-0.5 shrink-0 transition-colors cursor-pointer",
                task.isCompleted ? "text-success" : "text-muted hover:text-foreground"
              )}
              title={task.isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <p className={cn(
              "text-sm font-medium text-foreground leading-snug",
              task.isCompleted && "line-through text-muted"
            )}>
              {task.title}
            </p>
          </div>

          {task.description && (
            <p className="text-small text-muted mt-1 pl-6 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 pl-6">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority] ?? "bg-muted")} />

            {dueDateObj && (
              <span className={cn(
                "text-xs flex items-center gap-1",
                isOverdue ? "text-error" : isDueToday ? "text-warning" : "text-muted"
              )}>
                <Calendar className="w-3 h-3" />
                {format(dueDateObj, "dd/MM")}
                {isDueToday && " (hoje)"}
              </span>
            )}

            {task.assigneeName && (
              <div className="flex items-center gap-1 ml-auto">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-primary">
                    {task.assigneeName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canEdit && (
            <button onClick={() => onEdit(task)}
              className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(task.id)}
              className="p-1 rounded text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
