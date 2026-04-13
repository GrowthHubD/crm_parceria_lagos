"use client";

import { useState } from "react";
import { Users, Shield, CheckCircle2, XCircle, ChevronDown, Save, Loader2, UserPlus, X, Eye, EyeOff } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type UserRole = "partner" | "manager" | "operational";

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pipeline", label: "Pipeline" },
  { key: "contracts", label: "Contratos" },
  { key: "financial", label: "Financeiro" },
  { key: "crm", label: "CRM" },
  { key: "clients", label: "Clientes" },
  { key: "sdr", label: "Agente SDR" },
  { key: "kanban", label: "Kanban" },
  { key: "blog", label: "Blog" },
  { key: "admin", label: "Admin" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Permission {
  id: string;
  userId: string;
  module: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UsersAdminProps {
  initialUsers: UserRecord[];
  initialPermissions: Permission[];
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  partner: "Sócio",
  manager: "Gerente",
  operational: "Operacional",
};

const ROLE_COLORS: Record<string, string> = {
  partner: "bg-primary/10 text-primary",
  manager: "bg-info/10 text-info",
  operational: "bg-muted/10 text-muted",
};

export function UsersAdmin({ initialUsers, initialPermissions, currentUserId }: UsersAdminProps) {
  const [users, setUsers] = useState(initialUsers);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "operational" as UserRole });

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const getUserPerms = (userId: string): Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }> => {
    const result = {} as Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }>;
    for (const m of MODULES) {
      const found = permissions.find((p) => p.userId === userId && p.module === m.key);
      result[m.key] = {
        canView: found?.canView ?? false,
        canEdit: found?.canEdit ?? false,
        canDelete: found?.canDelete ?? false,
      };
    }
    return result;
  };

  const [localPerms, setLocalPerms] = useState<Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }> | null>(null);

  const handleSelectUser = (userId: string) => {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setLocalPerms(null);
      return;
    }
    setSelectedUserId(userId);
    setLocalPerms(getUserPerms(userId));
  };

  const handlePermChange = (module: ModuleKey, field: "canView" | "canEdit" | "canDelete", value: boolean) => {
    if (!localPerms) return;
    setLocalPerms((p) => {
      if (!p) return p;
      const updated = { ...p[module], [field]: value };
      // If disabling view, also disable edit and delete
      if (field === "canView" && !value) {
        updated.canEdit = false;
        updated.canDelete = false;
      }
      return { ...p, [module]: updated };
    });
  };

  const handleSavePerms = async (userId: string) => {
    if (!localPerms) return;
    setSavingPerm(userId);
    try {
      await Promise.all(
        MODULES.map(async (m) => {
          const res = await fetch(`/api/admin/users/${userId}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module: m.key, ...localPerms[m.key] }),
          });
          if (res.ok) {
            const data = await res.json();
            setPermissions((prev) => {
              const filtered = prev.filter((p) => !(p.userId === userId && p.module === m.key));
              return [...filtered, data.permission];
            });
          }
        })
      );
    } finally {
      setSavingPerm(null);
    }
  };

  const handleUserFieldChange = (field: keyof UserRecord, value: string | boolean) => {
    if (!editingUser) return;
    setEditingUser((u) => u ? { ...u, [field]: value } : u);
  };

  const handleSaveUser = async (userId: string) => {
    if (!editingUser) return;
    setSavingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUser.name,
          role: editingUser.role,
          jobTitle: editingUser.jobTitle,
          phone: editingUser.phone,
          isActive: editingUser.isActive,
        }),
      });
      if (res.ok) {
        setUsers((p) => p.map((u) => u.id === userId ? editingUser : u));
        setEditingUser(null);
      }
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Erro ao criar usuário.");
        return;
      }
      setUsers((prev) => [...prev, { ...data.user, createdAt: data.user.createdAt ?? new Date().toISOString() }]);
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "operational" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{users.length} usuário{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Criar usuário
        </button>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Criar novo usuário</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {createError && (
                <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{createError}</p>
              )}
              <div>
                <label className="text-label text-muted block mb-1">Nome completo</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="João Silva"
                />
              </div>
              <div>
                <label className="text-label text-muted block mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="joao@gmail.com"
                />
              </div>
              <div>
                <label className="text-label text-muted block mb-1">Senha inicial</label>
                <div className="relative">
                  <input
                    required
                    type={showCreatePwd ? "text" : "password"}
                    minLength={8}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-9 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowCreatePwd((v) => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors cursor-pointer">
                    {showCreatePwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">O usuário poderá alterar a senha depois em Configurações.</p>
              </div>
              <div>
                <label className="text-label text-muted block mb-1">Cargo (nível de acesso)</label>
                <Select
                  value={createForm.role}
                  onChange={(val) => setCreateForm((f) => ({ ...f, role: val as UserRole }))}
                  options={[
                    { value: "operational", label: "Operacional" },
                    { value: "manager", label: "Gerente" },
                    { value: "partner", label: "Sócio" },
                  ]}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {users.map((u) => {
        const isSelected = selectedUserId === u.id;
        const isMe = u.id === currentUserId;
        const isEditing = editingUser?.id === u.id;

        return (
          <div key={u.id} className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* User header */}
            <button
              onClick={() => handleSelectUser(u.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground text-sm">{u.name}</p>
                  {isMe && <span className="text-xs text-muted">(você)</span>}
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", ROLE_COLORS[u.role] ?? ROLE_COLORS.operational)}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  {!u.isActive && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-error/10 text-error">Inativo</span>
                  )}
                </div>
                <p className="text-small text-muted mt-0.5">{u.email}</p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted transition-transform shrink-0", isSelected && "rotate-180")} />
            </button>

            {/* Expanded section */}
            {isSelected && (
              <div className="border-t border-border">
                {/* User profile edit */}
                {!isMe && (
                  <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-medium text-foreground">Perfil</h3>
                      </div>
                      {!isEditing ? (
                        <button
                          onClick={() => setEditingUser({ ...u })}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
                          Editar
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-xs text-muted hover:text-foreground cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveUser(u.id)}
                            disabled={savingUserId === u.id}
                            className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {savingUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Salvar
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-label text-muted mb-1">Nome</label>
                          <input type="text" value={editingUser!.name}
                            onChange={(e) => handleUserFieldChange("name", e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                          <label className="block text-label text-muted mb-1">Cargo</label>
                          <Select value={editingUser!.role} onChange={(val) => handleUserFieldChange("role", val as UserRole)} options={[
                            { value: "partner", label: "Sócio" },
                            { value: "manager", label: "Gerente" },
                            { value: "operational", label: "Operacional" },
                          ]} />
                        </div>
                        <div>
                          <label className="block text-label text-muted mb-1">Título</label>
                          <input type="text" value={editingUser!.jobTitle ?? ""}
                            onChange={(e) => handleUserFieldChange("jobTitle", e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                          <label className="block text-label text-muted mb-1">Telefone</label>
                          <input type="text" value={editingUser!.phone ?? ""}
                            onChange={(e) => handleUserFieldChange("phone", e.target.value)}
                            placeholder="5511999999999"
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors font-mono" />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                            <input type="checkbox" checked={editingUser!.isActive}
                              onChange={(e) => handleUserFieldChange("isActive", e.target.checked)}
                              className="w-4 h-4 accent-primary cursor-pointer" />
                            <span className="text-sm text-foreground">Ativo</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-label text-muted">Título</p>
                          <p className="text-foreground mt-0.5">{u.jobTitle ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-label text-muted">Telefone</p>
                          <p className="text-foreground mt-0.5">{u.phone ?? "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Permissions matrix */}
                {!isMe && (
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-medium text-foreground">Permissões (sobrescrevem o padrão do cargo)</h3>
                      </div>
                      <button
                        onClick={() => handleSavePerms(u.id)}
                        disabled={savingPerm === u.id}
                        className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {savingPerm === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar permissões
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-label text-muted py-2 font-medium">Módulo</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Visualizar</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Editar</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Excluir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {MODULES.map((m) => {
                            const perm = localPerms?.[m.key] ?? { canView: false, canEdit: false, canDelete: false };
                            return (
                              <tr key={m.key} className="hover:bg-surface-2 transition-colors">
                                <td className="py-2 text-foreground">{m.label}</td>
                                {(["canView", "canEdit", "canDelete"] as const).map((field) => (
                                  <td key={field} className="py-2 text-center">
                                    <button
                                      onClick={() => handlePermChange(m.key, field, !perm[field])}
                                      className="cursor-pointer"
                                    >
                                      {perm[field] ? (
                                        <CheckCircle2 className="w-5 h-5 text-success mx-auto" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-muted/30 mx-auto" />
                                      )}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {isMe && (
                  <div className="px-5 py-4">
                    <p className="text-small text-muted">Não é possível editar sua própria conta. Use as configurações de perfil.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
