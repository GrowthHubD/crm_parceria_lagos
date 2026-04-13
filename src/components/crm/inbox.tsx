"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Search, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationView } from "./conversation-view";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select } from "@/components/ui/select";

interface Conversation {
  id: string;
  whatsappNumberId: string;
  contactPhone: string;
  contactName: string | null;
  contactPushName: string | null;
  classification: string;
  lastMessageAt: string | null;
  unreadCount: number;
  numberLabel: string | null;
  numberPhone: string | null;
}

interface WhatsappNumber {
  id: string;
  label: string;
  phoneNumber: string;
  isActive: boolean;
}

interface InboxProps {
  initialConversations: Conversation[];
  numbers: WhatsappNumber[];
  canEdit: boolean;
  currentUserId: string;
}

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string }> = {
  hot: { label: "Quente", color: "text-error" },
  warm: { label: "Morno", color: "text-warning" },
  cold: { label: "Frio", color: "text-info" },
  active_client: { label: "Cliente Ativo", color: "text-success" },
  new: { label: "Novo", color: "text-muted" },
};

export function Inbox({ initialConversations, numbers, canEdit }: InboxProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [numberFilter, setNumberFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Polling every 5s
  const refresh = useCallback(async () => {
    try {
      const q = numberFilter !== "all" ? `?numberId=${numberFilter}` : "";
      const res = await fetch(`/api/crm${q}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch { /* silent */ }
  }, [numberFilter]);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = conversations.filter((c) => {
    const name = c.contactName ?? c.contactPushName ?? c.contactPhone;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || c.contactPhone.includes(search);
    const matchNumber = numberFilter === "all" || c.whatsappNumberId === numberFilter;
    const matchClass = classificationFilter === "all" || c.classification === classificationFilter;
    return matchSearch && matchNumber && matchClass;
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    // Zero out unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  if (selectedId) {
    return (
      <ConversationView
        conversationId={selectedId}
        canEdit={canEdit}
        onBack={() => setSelectedId(null)}
        onClassificationChange={(id, classification) => {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, classification } : c))
          );
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato..."
            className="bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary w-52 transition-colors"
          />
        </div>
        {numbers.length > 1 && (
          <Select
            value={numberFilter}
            onChange={setNumberFilter}
            options={[
              { value: "all", label: "Todos os números" },
              ...numbers.map((n) => ({ value: n.id, label: n.label })),
            ]}
          />
        )}
        <Select
          value={classificationFilter}
          onChange={setClassificationFilter}
          options={[
            { value: "all", label: "Todas classificações" },
            ...Object.entries(CLASSIFICATION_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
          ]}
        />
        {totalUnread > 0 && (
          <span className="ml-auto bg-primary text-white text-xs px-2 py-1 rounded-full font-medium">
            {totalUnread} não lida{totalUnread > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Conversation list */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted/30 mx-auto mb-3" />
          <p className="text-muted text-sm">Nenhuma conversa encontrada</p>
          <p className="text-small text-muted/60 mt-1">As mensagens do WhatsApp aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border">
          {filtered.map((c) => {
            const name = c.contactName ?? c.contactPushName ?? c.contactPhone;
            const config = CLASSIFICATION_CONFIG[c.classification] ?? CLASSIFICATION_CONFIG.new;
            const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

            return (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left cursor-pointer"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{initials || "?"}</span>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm font-medium truncate", c.unreadCount > 0 ? "text-foreground" : "text-foreground/80")}>
                      {name}
                    </p>
                    {c.lastMessageAt && (
                      <span className="text-small text-muted shrink-0">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { locale: ptBR, addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Circle className={cn("w-2 h-2 fill-current shrink-0", config.color)} />
                    <span className={cn("text-small", config.color)}>{config.label}</span>
                    {c.numberLabel && (
                      <span className="text-small text-muted/60 ml-auto truncate">{c.numberLabel}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
