"use client";

import { useState } from "react";
import { Plus, BookOpen, FileText, Edit, Trash2, Loader2, Search, Eye, EyeOff, FolderPlus, LayoutGrid, List } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PostEditorModal } from "./post-editor-modal";
import { MarkdownRenderer } from "./markdown-renderer";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  order: number;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  coverImageUrl: string | null;
  categoryId: string;
  categoryName: string | null;
  authorId: string;
  authorName: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BlogListProps {
  initialCategories: Category[];
  initialPosts: Post[];
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  article: { label: "Artigo", color: "bg-primary/10 text-primary" },
  guide:   { label: "Guia",   color: "bg-success/10 text-success" },
  list:    { label: "Lista",  color: "bg-info/10 text-info" },
  study:   { label: "Estudo", color: "bg-secondary/10 text-secondary" },
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 100);

export function BlogList({ initialCategories, initialPosts, canEdit, canDelete, currentUserId }: BlogListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<(Post & { content?: string }) | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = posts.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.excerpt ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCat === "all" || p.categoryId === selectedCat;
    return matchSearch && matchCat;
  });

  const handleDelete = (id: string) => setPendingDelete(id);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setPendingDelete(null);
    setDeletingId(pendingDelete);
    try {
      const res = await fetch(`/api/blog/posts/${pendingDelete}`, { method: "DELETE" });
      if (res.ok) setPosts((p) => p.filter((post) => post.id !== pendingDelete));
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewPost = async (post: Post) => {
    const res = await fetch(`/api/blog/posts/${post.id}`);
    if (res.ok) {
      const data = await res.json();
      setViewingPost({ ...post, content: data.post.content });
    }
  };

  const handleTogglePublish = async (post: Post) => {
    const res = await fetch(`/api/blog/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !post.isPublished }),
    });
    if (res.ok) {
      setPosts((p) => p.map((x) => x.id === post.id ? { ...x, isPublished: !x.isPublished } : x));
    }
  };

  // ── Post Card (grid view) ──────────────────────────────────────────────────
  const PostCard = ({ post }: { post: Post }) => {
    const typeInfo = TYPE_LABELS[post.type] ?? TYPE_LABELS.article;
    return (
      <div
        onClick={() => handleViewPost(post)}
        className="group relative bg-surface border border-border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-border/80 flex flex-col"
      >
        {/* Cover */}
        <div className="relative h-40 bg-surface-2 overflow-hidden shrink-0">
          {post.coverImageUrl ? (
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surface-2">
              <FileText className="w-10 h-10 text-muted/30" />
            </div>
          )}
          {/* Draft badge */}
          {!post.isPublished && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-warning/90 text-white backdrop-blur-sm">
              Rascunho
            </span>
          )}
          {/* Actions overlay */}
          {(canEdit || canDelete) && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTogglePublish(post); }}
                    title={post.isPublished ? "Despublicar" : "Publicar"}
                    className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                  >
                    {post.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPost(post); setModalOpen(true); }}
                    className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                  disabled={deletingId === post.id}
                  className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600/80 transition-colors backdrop-blur-sm disabled:opacity-50"
                >
                  {deletingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", typeInfo.color)}>{typeInfo.label}</span>
            {post.categoryName && (
              <span className="text-xs text-muted">{post.categoryName}</span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="text-sm text-muted leading-relaxed line-clamp-2">{post.excerpt}</p>
          )}
          <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-muted border-t border-border/50">
            <span>{post.authorName ?? "—"}</span>
            <span>·</span>
            <span>{format(new Date(post.updatedAt), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Post Row (list view) ───────────────────────────────────────────────────
  const PostRow = ({ post }: { post: Post }) => {
    const typeInfo = TYPE_LABELS[post.type] ?? TYPE_LABELS.article;
    return (
      <tr className="hover:bg-surface-2 transition-colors group cursor-pointer" onClick={() => handleViewPost(post)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {post.coverImageUrl ? (
              <img src={post.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-muted/50" />
              </div>
            )}
            <span className="font-medium text-foreground text-sm hover:text-primary transition-colors">{post.title}</span>
          </div>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell text-muted text-sm">{post.categoryName ?? "—"}</td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className={cn("px-2 py-1 rounded text-xs font-medium", typeInfo.color)}>{typeInfo.label}</span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell text-muted text-sm">{post.authorName ?? "—"}</td>
        <td className="px-4 py-3">
          <span className={cn("px-2 py-1 rounded text-xs font-medium",
            post.isPublished ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
            {post.isPublished ? "Publicado" : "Rascunho"}
          </span>
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <>
                <button onClick={() => handleTogglePublish(post)} title={post.isPublished ? "Despublicar" : "Publicar"}
                  className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
                  {post.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditingPost(post); setModalOpen(true); }}
                  className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
                  <Edit className="w-4 h-4" />
                </button>
              </>
            )}
            {canDelete && (
              <button onClick={() => handleDelete(post.id)} disabled={deletingId === post.id}
                className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50">
                {deletingId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar post..."
                className="bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary w-48 transition-colors"
              />
            </div>
            <select
              value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
              <button onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded transition-colors cursor-pointer",
                  viewMode === "grid" ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded transition-colors cursor-pointer",
                  viewMode === "list" ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setCatModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium cursor-pointer shrink-0"
              >
                <FolderPlus className="w-4 h-4" /> Nova categoria
              </button>
              <button
                onClick={() => { setEditingPost(null); setModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Novo Post
              </button>
            </div>
          )}
        </div>

        <p className="text-small text-muted">{filtered.length} post{filtered.length !== 1 ? "s" : ""}</p>

        {filtered.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">Nenhum post encontrado.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Título</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden sm:table-cell">Categoria</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium hidden lg:table-cell">Autor</th>
                    <th className="text-left text-label text-muted px-4 py-3 font-medium">Status</th>
                    <th className="text-right text-label text-muted px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => <PostRow key={p.id} post={p} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Post editor modal */}
      {modalOpen && (
        <PostEditorModal
          categories={categories}
          post={editingPost ?? undefined}
          onClose={() => { setModalOpen(false); setEditingPost(null); }}
          onSuccess={(post) => {
            if (editingPost) {
              setPosts((p) => p.map((x) => x.id === post.id ? { ...x, ...post } : x));
            } else {
              setPosts((p) => [post, ...p]);
            }
            setModalOpen(false);
            setEditingPost(null);
          }}
        />
      )}

      {/* Post viewer modal */}
      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          onClose={() => setViewingPost(null)}
          onEdit={canEdit ? () => { setEditingPost(viewingPost); setViewingPost(null); setModalOpen(true); } : undefined}
        />
      )}

      {/* Category modal */}
      {catModalOpen && (
        <CategoryModal
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onSuccess={(cat) => {
            setCategories((prev) => [...prev, cat].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)));
            setCatModalOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir post"
        message="Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

// ── Post Viewer ───────────────────────────────────────────────────────────────

function PostViewerModal({
  post,
  onClose,
  onEdit,
}: {
  post: Post & { content?: string };
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-xl border border-border w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cover image */}
        {post.coverImageUrl && (
          <div className="h-52 shrink-0 overflow-hidden">
            <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-bold text-foreground leading-snug">{post.title}</h2>
            <p className="text-small text-muted mt-1">
              {post.categoryName ?? "Sem categoria"}
              {post.authorName ? ` · ${post.authorName}` : ""}
              {" · "}{format(new Date(post.updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
                <Edit className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {post.content ? (
            <MarkdownRenderer content={post.content} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Category Modal ────────────────────────────────────────────────────────────

function CategoryModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: Category[];
  onClose: () => void;
  onSuccess: (cat: Category) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", parentId: "", order: 0 });

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/blog/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          parentId: form.parentId || null,
          order: form.order,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.category);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao criar categoria.");
      }
    } finally {
      setSaving(false);
    }
  }

  const parentOptions = categories.filter((c) => !c.parentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">Nova Categoria</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-label text-muted mb-1">Nome</label>
            <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required
              placeholder="Ex: Processos internos"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-label text-muted mb-1">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-label text-muted mb-1">Categoria pai (opcional)</label>
            <select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer">
              <option value="">Nenhuma (categoria raiz)</option>
              {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-label text-muted mb-1">Descrição (opcional)</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Breve descrição…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer disabled:opacity-50">
              {saving ? "Criando…" : "Criar categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
