"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, Tag, UserPlus, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  direction: string;
  content: string | null;
  mediaType: string | null;
  status: string | null;
  timestamp: string;
}

interface Conversation {
  id: string;
  contactPhone: string;
  contactName: string | null;
  contactPushName: string | null;
  classification: string;
  unreadCount: number;
}

interface LinkedLead {
  id: string;
  name: string;
  companyName: string | null;
  stageName: string | null;
  stageColor: string | null;
  estimatedValue: string | null;
  isConverted: boolean;
}

const CLASSIFICATION_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "hot", label: "Quente 🔥" },
  { value: "warm", label: "Morno" },
  { value: "cold", label: "Frio" },
  { value: "active_client", label: "Cliente Ativo" },
];

interface ConversationViewProps {
  conversationId: string;
  canEdit: boolean;
  onBack: () => void;
  onClassificationChange: (id: string, classification: string) => void;
}

export function ConversationView({ conversationId, canEdit, onBack, onClassificationChange }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [linkedLead, setLinkedLead] = useState<LinkedLead | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkingLead, setLinkingLead] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages);
        if (data.linkedLead) setLinkedLead(data.linkedLead);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [conversationId]);

  const handleCreateLead = async () => {
    setLinkingLead(true);
    try {
      const res = await fetch(`/api/crm/${conversationId}/link-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createNew: true }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Lead criado!");
        // Refetch para pegar o lead vinculado
        fetchMessages();
      } else {
        toast.error("Erro ao criar lead");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLinkingLead(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/crm/${conversationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: inputText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInputText("");
      }
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const handleClassificationChange = async (value: string) => {
    await fetch(`/api/crm/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification: value }),
    });
    setConversation((prev) => prev ? { ...prev, classification: value } : prev);
    onClassificationChange(conversationId, value);
  };

  const name = conversation?.contactName ?? conversation?.contactPushName ?? conversation?.contactPhone ?? "...";

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">
            {name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-small text-muted">{conversation?.contactPhone}</p>
        </div>
        {/* Lead badge ou botão criar */}
        {linkedLead ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-lg shrink-0">
            <GitBranch className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">{linkedLead.name}</span>
            {linkedLead.stageName && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${linkedLead.stageColor ?? "#6C5CE7"}20`,
                  color: linkedLead.stageColor ?? "#6C5CE7",
                }}
              >
                {linkedLead.stageName}
              </span>
            )}
          </div>
        ) : canEdit && conversation && (
          <button
            onClick={handleCreateLead}
            disabled={linkingLead}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
          >
            {linkingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Criar Lead
          </button>
        )}

        {canEdit && conversation && (
          <div className="flex items-center gap-2 shrink-0">
            <Tag className="w-4 h-4 text-muted" />
            <select
              value={conversation.classification}
              onChange={(e) => handleClassificationChange(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              {CLASSIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.direction === "outgoing";
            return (
              <div key={msg.id} className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                  isOutgoing
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-surface-2 text-foreground rounded-bl-sm"
                )}>
                  {msg.content ? (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <p className="italic opacity-70">[{msg.mediaType ?? "media"}]</p>
                  )}
                  <p className={cn("text-[10px] mt-1", isOutgoing ? "text-white/70 text-right" : "text-muted")}>
                    {format(new Date(msg.timestamp), "HH:mm")}
                    {isOutgoing && msg.status && (
                      <span className="ml-1 opacity-70">· {msg.status}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canEdit && (
        <div className="border-t border-border p-3 flex items-end gap-2 shrink-0">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none max-h-32"
            style={{ overflowY: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
