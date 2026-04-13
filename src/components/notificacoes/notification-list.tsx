"use client";

import { useState } from "react";
import { Bell, BellOff, CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  module: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListProps {
  initialNotifications: Notification[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  contract_expiring: { label: "Contrato", color: "text-warning", dotColor: "bg-warning" },
  task_due: { label: "Tarefa", color: "text-info", dotColor: "bg-info" },
  payment_overdue: { label: "Pagamento", color: "text-error", dotColor: "bg-error" },
  new_lead: { label: "Lead", color: "text-success", dotColor: "bg-success" },
  system: { label: "Sistema", color: "text-muted", dotColor: "bg-muted" },
};

export function NotificationList({ initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();

  const unread = notifications.filter((n) => !n.isRead);

  const markAsRead = async (id: string) => {
    const res = await fetch(`/api/notificacoes/${id}`, { method: "PATCH" });
    if (res.ok) {
      setNotifications((p) => p.map((n) => n.id === id ? { ...n, isRead: true } : n));
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notificacoes/read-all", { method: "POST" });
      if (res.ok) {
        setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-small text-muted">
          {unread.length} não lida{unread.length !== 1 ? "s" : ""} · {notifications.length} total
        </p>
        {unread.length > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-16 text-center">
          <Bell className="w-12 h-12 text-muted/30 mx-auto mb-3" />
          <p className="text-muted text-sm">Nenhuma notificação ainda.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border">
          {notifications.map((n) => {
            const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  !n.isRead ? "bg-surface-2 hover:bg-surface cursor-pointer" : "hover:bg-surface-2 cursor-pointer"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", n.isRead ? "bg-transparent" : config.dotColor)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded bg-surface border border-border", config.color)}>
                      {config.label}
                    </span>
                    <p className={cn("text-sm font-medium", n.isRead ? "text-muted" : "text-foreground")}>
                      {n.title}
                    </p>
                  </div>
                  <p className="text-small text-muted mt-0.5">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-small text-muted whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                  </span>
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                      title="Marcar como lida"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {n.link && (
                    <ExternalLink className="w-3.5 h-3.5 text-muted" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
