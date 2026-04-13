"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, Tags, Columns, X, Trophy } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KanbanColumn } from "./kanban-column";
import { LeadCard } from "./lead-card";
import { LeadModal } from "./lead-modal";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  stageId: string;
  source: string | null;
  estimatedValue: string | null;
  notes: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  updatedAt: string;
  tags: Tag[];
}

interface Stage {
  id: string;
  name: string;
  color: string | null;
  order: number;
  isWon: boolean;
}

interface TeamUser {
  id: string;
  name: string;
}

interface Funnel {
  id: string;
  name: string;
  isDefault: boolean;
}

interface KanbanBoardProps {
  initialStages: Stage[];
  initialLeads: Lead[];
  initialTags: Tag[];
  users: TeamUser[];
  currentUserId: string;
  funnels: Funnel[];
  activePipelineId: string;
  canEdit: boolean;
  canDelete: boolean;
}

// ── Tag Manager Modal ────────────────────────────────────────────────────────

function TagManagerModal({ tags, onClose, onTagsChange }: {
  tags: Tag[];
  onClose: () => void;
  onTagsChange: (tags: Tag[]) => void;
}) {
  const [localTags, setLocalTags] = useState(tags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const tag = await res.json();
        const updated = [...localTags, tag];
        setLocalTags(updated);
        onTagsChange(updated);
        setNewName("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/pipeline/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const updated = localTags.filter((t) => t.id !== id);
      setLocalTags(updated);
      onTagsChange(updated);
    }
  };

  const [pendingTagDelete, setPendingTagDelete] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Gerenciar Tags</h2>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing tags */}
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
          {localTags.length === 0 && (
            <p className="text-sm text-muted text-center py-4">Nenhuma tag criada</p>
          )}
          {localTags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-sm text-foreground">{tag.name}</span>
              </div>
              <button
                onClick={() => setPendingTagDelete(tag.id)}
                className="text-xs text-muted hover:text-error transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* New tag */}
        <div className="flex gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-border bg-transparent shrink-0"
            title="Cor da tag"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Nome da tag"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingTagDelete}
        title="Excluir tag"
        message="Tem certeza que deseja excluir esta tag?"
        onConfirm={() => { if (pendingTagDelete) { handleDelete(pendingTagDelete); setPendingTagDelete(null); } }}
        onCancel={() => setPendingTagDelete(null)}
      />
    </div>
  );
}

// ── New Stage Modal ──────────────────────────────────────────────────────────

function NewStageModal({ onClose, onCreated, pipelineId }: {
  onClose: () => void;
  onCreated: (stage: Stage) => void;
  pipelineId: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6C5CE7");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, pipelineId }),
      });
      if (res.ok) {
        const stage = await res.json();
        onCreated(stage);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Nova Etapa</h2>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Nome da etapa</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Ex: Qualificação"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Cor</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-border bg-transparent"
              />
              <span className="text-xs text-muted">{color}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-muted border border-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Criando..." : "Criar Etapa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Board ───────────────────────────────────────────────────────────────

export function KanbanBoard({
  initialStages,
  initialLeads,
  initialTags,
  users,
  currentUserId,
  funnels: initialFunnels,
  activePipelineId: initialPipelineId,
  canEdit,
  canDelete,
}: KanbanBoardProps) {
  const [stages, setStages] = useState(initialStages);
  const [leads, setLeads] = useState(initialLeads);
  const [allTags, setAllTags] = useState(initialTags);
  const [funnels, setFunnels] = useState(initialFunnels);
  const [activePipelineId, setActivePipelineId] = useState(initialPipelineId);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [newStageOpen, setNewStageOpen] = useState(false);
  const wonStageId = stages.find((s) => s.isWon)?.id ?? "";

  // Trocar de funil — refetch dados
  const handleSwitchFunnel = useCallback(async (pipelineId: string) => {
    setActivePipelineId(pipelineId);
    try {
      const res = await fetch(`/api/pipeline?pipelineId=${pipelineId}`);
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages);
        setLeads(data.leads);
      }
    } catch { /* keep current data */ }
  }, []);

  const handleSetWonStage = async (stageId: string) => {
    // Optimistic update
    setStages((prev) => prev.map((s) => ({ ...s, isWon: s.id === stageId })));
    await fetch("/api/pipeline/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stageId, isWon: true }),
    });
  };
  const [pendingLeadDelete, setPendingLeadDelete] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredLeads = activeTagFilter
    ? leads.filter((l) => l.tags.some((t) => t.name === activeTagFilter))
    : leads;

  const getLeadsForStage = (stageId: string) =>
    filteredLeads.filter((l) => l.stageId === stageId);

  // ─── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = ({ active }: DragStartEvent) => {
    const lead = leads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const overStage = stages.find((s) => s.id === overId);
    if (overStage) {
      setLeads((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, stageId: overStage.id } : l))
      );
      return;
    }

    const overLead = leads.find((l) => l.id === overId);
    if (overLead && overLead.stageId !== leads.find((l) => l.id === activeId)?.stageId) {
      setLeads((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, stageId: overLead.stageId } : l))
      );
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveLead(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const movedLead = leads.find((l) => l.id === activeId);
    if (!movedLead) return;

    const overLead = leads.find((l) => l.id === overId);
    if (overLead && overLead.stageId === movedLead.stageId) {
      const stageLeads = getLeadsForStage(movedLead.stageId);
      const oldIndex = stageLeads.findIndex((l) => l.id === activeId);
      const newIndex = stageLeads.findIndex((l) => l.id === overId);
      if (oldIndex !== newIndex) {
        const reordered = arrayMove(stageLeads, oldIndex, newIndex);
        setLeads((prev) => {
          const others = prev.filter((l) => l.stageId !== movedLead.stageId);
          return [...others, ...reordered];
        });
      }
      return;
    }

    try {
      await fetch(`/api/pipeline/leads/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: movedLead.stageId }),
      });
    } catch {
      setLeads(initialLeads);
    }
  };

  // ─── Lead CRUD ─────────────────────────────────────────────────────────────

  const handleAddLead = (stageId: string) => {
    setEditingLead(null);
    setDefaultStageId(stageId);
    setModalOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setDefaultStageId(lead.stageId);
    setModalOpen(true);
  };

  const handleDeleteLead = (id: string) => setPendingLeadDelete(id);

  const confirmLeadDelete = async () => {
    if (!pendingLeadDelete) return;
    setPendingLeadDelete(null);
    const res = await fetch(`/api/pipeline/leads/${pendingLeadDelete}`, { method: "DELETE" });
    if (res.ok) setLeads((prev) => prev.filter((l) => l.id !== pendingLeadDelete));
  };

  const handleLeadSaved = useCallback((savedLead: Record<string, unknown>) => {
    const lead = savedLead as unknown as Lead;
    setLeads((prev) => {
      const exists = prev.find((l) => l.id === lead.id);
      if (exists) {
        return prev.map((l) => l.id === lead.id ? { ...l, ...lead, tags: l.tags } : l);
      }
      return [...prev, { ...lead, tags: [], assigneeName: null, updatedAt: new Date().toISOString() }];
    });
  }, []);

  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

  return (
    <>
      {/* ── Page header row: title + actions ── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h1 text-foreground">Pipeline</h1>
            {funnels.length > 1 && (
              <div className="w-48">
                <Select
                  value={activePipelineId}
                  onChange={handleSwitchFunnel}
                  options={funnels.map((f) => ({ value: f.id, label: f.name }))}
                  placeholder="Selecionar funil..."
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted">
            <span><strong className="text-foreground">{totalLeads}</strong> leads</span>
            {totalValue > 0 && (
              <span>
                <strong className="text-success">
                  R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong> estimado
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setTagManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Tags className="w-3.5 h-3.5" />
              Gerenciar Tags
            </button>
            <div className="flex items-center gap-1.5 min-w-[180px]">
              <Trophy className="w-3.5 h-3.5 text-warning shrink-0" />
              <Select
                value={wonStageId}
                onChange={handleSetWonStage}
                placeholder="Etapa de ganho…"
                options={[
                  { value: "", label: "Nenhuma" },
                  ...stages.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
            <button
              onClick={() => setNewStageOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Columns className="w-3.5 h-3.5" />
              Nova Etapa
            </button>
            <button
              onClick={() => handleAddLead(stages[0]?.id ?? "")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Lead
            </button>
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5 p-3 bg-surface rounded-xl border border-border">
          <span className="text-xs font-medium text-muted uppercase tracking-wide mr-1">Filtros:</span>
          <button
            onClick={() => setActiveTagFilter(null)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
              activeTagFilter === null
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            )}
          >
            Todos os grupos
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTagFilter(activeTagFilter === tag.name ? null : tag.name)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer",
                activeTagFilter === tag.name
                  ? "text-white"
                  : "text-muted hover:text-foreground"
              )}
              style={activeTagFilter === tag.name ? { backgroundColor: tag.color } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: activeTagFilter === tag.name ? "white" : tag.color }}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Board — horizontal scroll ── */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3 min-w-max">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={getLeadsForStage(stage.id)}
                onAddLead={handleAddLead}
                onEditLead={handleEditLead}
                onDeleteLead={handleDeleteLead}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="rotate-1 shadow-xl opacity-95">
              <LeadCard
                lead={activeLead}
                onEdit={() => {}}
                onDelete={() => {}}
                canEdit={false}
                canDelete={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Modals ── */}
      <LeadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLead(null); }}
        onSuccess={handleLeadSaved}
        stages={stages}
        users={users}
        currentUserId={currentUserId}
        initialData={
          editingLead
            ? {
                id: editingLead.id,
                name: editingLead.name,
                companyName: editingLead.companyName ?? "",
                email: editingLead.email ?? "",
                phone: editingLead.phone ?? "",
                stageId: editingLead.stageId,
                source: editingLead.source ?? "",
                estimatedValue: editingLead.estimatedValue ?? "",
                notes: editingLead.notes ?? "",
                assignedTo: editingLead.assignedTo ?? "",
              }
            : { stageId: defaultStageId }
        }
        mode={editingLead ? "edit" : "create"}
      />

      {tagManagerOpen && (
        <TagManagerModal
          tags={allTags}
          onClose={() => setTagManagerOpen(false)}
          onTagsChange={setAllTags}
        />
      )}

      {newStageOpen && (
        <NewStageModal
          onClose={() => setNewStageOpen(false)}
          onCreated={(stage) => setStages((prev) => [...prev, stage])}
          pipelineId={activePipelineId}
        />
      )}

      <ConfirmDialog
        open={!!pendingLeadDelete}
        title="Excluir lead"
        message="Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita."
        onConfirm={confirmLeadDelete}
        onCancel={() => setPendingLeadDelete(null)}
      />
    </>
  );
}
