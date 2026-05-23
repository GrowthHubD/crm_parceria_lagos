"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, BookUser, MessageSquare, Phone, Mail, Building2, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface Contact {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  estimatedValue: string | null;
  isConverted: boolean;
  createdAt: string;
  updatedAt: string;
  stageId: string;
  stageName: string | null;
  stageColor: string | null;
  crmConversationId: string | null;
  lastMessageAt: string | null;
  contactPushName: string | null;
  contactProfilePicUrl: string | null;
  unreadCount: number | null;
  classification: string | null;
}

interface ContatosListProps {
  initialContacts: Contact[];
}

const CLASSIFICATION_LABEL: Record<string, { label: string; color: string }> = {
  hot: { label: "Quente", color: "text-error" },
  warm: { label: "Morno", color: "text-warning" },
  cold: { label: "Frio", color: "text-info" },
  active_client: { label: "Cliente", color: "text-success" },
  new: { label: "Novo", color: "text-muted" },
};

export function ContatosList({ initialContacts }: ContatosListProps) {
  const [contacts] = useState<Contact[]>(initialContacts);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      const haystack = [c.name, c.companyName, c.phone, c.email, c.contactPushName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [contacts, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-h1 text-foreground flex items-center gap-2">
            <BookUser className="w-6 h-6 text-primary" />
            Contatos
          </h1>
          <p className="text-muted text-sm mt-1">
            {filtered.length} de {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, telefone ou email…"
          className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <BookUser className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
          <p className="text-foreground font-medium text-sm">Nenhum contato encontrado</p>
          <p className="text-muted text-xs mt-1">
            {search ? "Tente outra busca." : "Quando chegarem mensagens WhatsApp ou leads forem criados, vão aparecer aqui."}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border">
          {filtered.map((c) => {
            const displayName = c.name || c.contactPushName || c.phone || "—";
            const initials = displayName
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const lastMsgRelative = c.lastMessageAt
              ? formatDistanceToNow(new Date(c.lastMessageAt), { locale: ptBR, addSuffix: true })
              : null;
            const classConfig = c.classification ? CLASSIFICATION_LABEL[c.classification] : null;

            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {c.contactProfilePicUrl?.startsWith("http") ? (
                    <img
                      src={c.contactProfilePicUrl}
                      alt={displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{initials || "?"}</span>
                    </div>
                  )}
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    {c.isConverted && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
                        Convertido
                      </span>
                    )}
                    {classConfig && (
                      <span className={cn("text-xs", classConfig.color)}>{classConfig.label}</span>
                    )}
                    {(c.unreadCount ?? 0) > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary text-white font-bold">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.companyName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {c.companyName}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage + última msg */}
                <div className="hidden md:flex flex-col items-end text-xs gap-0.5 shrink-0">
                  {c.stageName && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (c.stageColor ?? "#6366f1") + "20",
                        color: c.stageColor ?? "#6366f1",
                      }}
                    >
                      {c.stageName}
                    </span>
                  )}
                  {lastMsgRelative && (
                    <span className="text-muted flex items-center gap-1 mt-0.5">
                      <MessageSquare className="w-3 h-3" />
                      {lastMsgRelative}
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  {c.crmConversationId && (
                    <Link
                      href={`/crm?conversation=${c.crmConversationId}`}
                      className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                      title="Abrir conversa no CRM"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                  )}
                  <Link
                    href={`/pipeline?lead=${c.id}`}
                    className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                    title="Ver no pipeline"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
