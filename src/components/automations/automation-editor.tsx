"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2, Trash2, Clock, MessageSquare, Mail, GripVertical } from "lucide-react";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Step {
  id?: string;
  type: string;
  config: Record<string, unknown>;
}

interface Stage {
  id: string;
  name: string;
}

interface AutomationEditorProps {
  automationId: string | null;
  stages: Stage[];
  onClose: () => void;
  onSaved: (automation: Record<string, unknown>) => void;
}

const STEP_TYPES = [
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: MessageSquare },
  { value: "wait", label: "Aguardar", icon: Clock },
  { value: "send_email", label: "Enviar Email", icon: Mail },
];

export function AutomationEditor({ automationId, stages, onClose, onSaved }: AutomationEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("stage_enter");
  const [triggerStageId, setTriggerStageId] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!automationId);

  // Fetch automação existente
  useEffect(() => {
    if (!automationId) return;
    fetch(`/api/automations/${automationId}`)
      .then((r) => r.json())
      .then((data) => {
        const auto = data.automation;
        setName(auto.name);
        setDescription(auto.description ?? "");
        setTriggerType(auto.triggerType);
        setTriggerStageId((auto.triggerConfig as Record<string, string>)?.stageId ?? "");
        setSteps(
          data.steps.map((s: Record<string, unknown>) => ({
            id: s.id,
            type: s.type as string,
            config: s.config as Record<string, unknown>,
          }))
        );
      })
      .finally(() => setFetching(false));
  }, [automationId]);

  const addStep = (type: string) => {
    const defaultConfig: Record<string, unknown> =
      type === "wait"
        ? { delayMinutes: 60 }
        : type === "send_whatsapp"
          ? { message: "" }
          : { subject: "", body: "" };

    setSteps((prev) => [...prev, { type, config: defaultConfig }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStepConfig = (idx: number, key: string, value: unknown) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, config: { ...s.config, [key]: value } } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const triggerConfig: Record<string, unknown> = {};
    if (triggerType === "stage_enter" && triggerStageId) triggerConfig.stageId = triggerStageId;

    const body = {
      name: name.trim(),
      description: description || null,
      triggerType,
      triggerConfig: Object.keys(triggerConfig).length > 0 ? triggerConfig : null,
      steps: steps.map((s) => ({ type: s.type, config: s.config })),
    };

    try {
      const url = automationId ? `/api/automations/${automationId}` : "/api/automations";
      const method = automationId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(automationId ? "Automação salva!" : "Automação criada!");
        // Refetch completo para ter os steps com IDs
        const detail = await fetch(`/api/automations/${data.automation.id}`).then((r) => r.json());
        onSaved({ ...detail.automation, steps: detail.steps });
      } else {
        toast.error("Erro ao salvar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const templateVars = "{{nome}}, {{empresa}}, {{telefone}}, {{email}}";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {automationId ? "Editar Automação" : "Nova Automação"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Nome */}
            <div>
              <label className="text-xs text-muted block mb-1">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Follow-up após reunião"
                required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="text-xs text-muted block mb-1">Descrição (opcional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="text-xs text-muted block mb-1">Gatilho</label>
              <Select
                value={triggerType}
                onChange={setTriggerType}
                options={[
                  { value: "stage_enter", label: "Ao entrar em etapa" },
                  { value: "tag_added", label: "Ao adicionar tag" },
                  { value: "manual", label: "Disparo manual" },
                ]}
              />
            </div>

            {triggerType === "stage_enter" && (
              <div>
                <label className="text-xs text-muted block mb-1">Etapa que dispara</label>
                <Select
                  value={triggerStageId}
                  onChange={setTriggerStageId}
                  placeholder="Selecionar etapa..."
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
            )}

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted">Etapas da automação</label>
                <div className="flex gap-1">
                  {STEP_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => addStep(t.value)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-foreground border border-border rounded hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <t.icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {steps.length === 0 && (
                <p className="text-xs text-muted text-center py-4 bg-surface-2 rounded-lg">
                  Adicione etapas usando os botões acima
                </p>
              )}

              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="bg-surface-2 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted w-5">{idx + 1}.</span>
                        <span className="text-xs font-medium text-foreground">
                          {STEP_TYPES.find((t) => t.value === step.type)?.label ?? step.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="p-1 text-muted hover:text-error transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {step.type === "send_whatsapp" && (
                      <div>
                        <textarea
                          value={(step.config.message as string) ?? ""}
                          onChange={(e) => updateStepConfig(idx, "message", e.target.value)}
                          placeholder={`Olá {{nome}}, tudo bem?\n\nVariáveis: ${templateVars}`}
                          rows={3}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary resize-none"
                        />
                      </div>
                    )}

                    {step.type === "wait" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={(step.config.delayMinutes as number) ?? 60}
                          onChange={(e) => updateStepConfig(idx, "delayMinutes", Number(e.target.value))}
                          className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                        />
                        <span className="text-xs text-muted">minutos</span>
                      </div>
                    )}

                    {step.type === "send_email" && (
                      <div className="space-y-2">
                        <input
                          value={(step.config.subject as string) ?? ""}
                          onChange={(e) => updateStepConfig(idx, "subject", e.target.value)}
                          placeholder="Assunto do email"
                          className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
                        />
                        <textarea
                          value={(step.config.body as string) ?? ""}
                          onChange={(e) => updateStepConfig(idx, "body", e.target.value)}
                          placeholder="Corpo do email..."
                          rows={2}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {automationId ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
