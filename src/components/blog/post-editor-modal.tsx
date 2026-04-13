"use client";

import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, ImagePlus, Paperclip, X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useUiSound } from "@/hooks/use-ui-sound";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  categoryId: string;
  coverImageUrl: string | null;
  isPublished: boolean;
}

interface PostEditorModalProps {
  categories: Category[];
  post?: Post;
  onClose: () => void;
  onSuccess: (post: Post & { categoryName: string | null; authorName: string | null; updatedAt: string; createdAt: string; coverImageUrl: string | null; authorId: string; publishedAt: string | null }) => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);

async function uploadFile(file: File): Promise<{ url: string; webViewLink: string; name: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/blog/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error ?? "Erro no upload");
  }
  const d = await res.json();
  return { url: d.url, webViewLink: d.webViewLink, name: file.name };
}

export function PostEditorModal({ categories, post, onClose, onSuccess }: PostEditorModalProps) {
  const { playSound } = useUiSound();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    content: "",
    excerpt: post?.excerpt ?? "",
    type: post?.type ?? "article",
    categoryId: post?.categoryId ?? (categories[0]?.id ?? ""),
    coverImageUrl: post?.coverImageUrl ?? "",
    isPublished: post?.isPublished ?? false,
  });

  const [coverUploading, setCoverUploading] = useState(false);
  const [inlineUploading, setInlineUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    playSound("open");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (post) {
      fetch(`/api/blog/posts/${post.id}`)
        .then((r) => r.json())
        .then((d) => setForm((f) => ({ ...f, content: d.post?.content ?? "" })));
    }
  }, [post]);

  useEffect(() => {
    if (!post) {
      setForm((f) => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, post]);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadFile(file);
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro no upload da capa");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  }

  async function handleInlineUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineUploading(true);
    setUploadError(null);
    try {
      const { url, webViewLink, name } = await uploadFile(file);
      const isImage = file.type.startsWith("image/");
      const markdown = isImage ? `![${name}](${url})` : `[${name}](${webViewLink})`;

      // Insert at cursor position in textarea
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart ?? form.content.length;
        const end = ta.selectionEnd ?? form.content.length;
        const newContent =
          form.content.slice(0, start) +
          (start > 0 && form.content[start - 1] !== "\n" ? "\n" : "") +
          markdown +
          "\n" +
          form.content.slice(end);
        setForm((f) => ({ ...f, content: newContent }));
        // Restore focus and cursor after state update
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(start + markdown.length + 1, start + markdown.length + 1);
        }, 0);
      } else {
        setForm((f) => ({ ...f, content: f.content + "\n" + markdown + "\n" }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setInlineUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) {
      setSubmitError("Selecione uma categoria antes de salvar.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const url = post ? `/api/blog/posts/${post.id}` : "/api/blog/posts";
      const method = post ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coverImageUrl: form.coverImageUrl || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        playSound("save");
        onSuccess(data.post);
      } else {
        const data = await res.json().catch(() => ({}));
        playSound("error");
        setSubmitError(data.error ?? "Erro ao salvar post.");
      }
    } finally {
      setSaving(false);
    }
  }

  const rootCats = categories.filter((c) => !c.parentId);
  const subCats = (id: string) => categories.filter((c) => c.parentId === id);

  const categoryOptions = rootCats.flatMap((cat) => [
    { value: cat.id, label: cat.name },
    ...subCats(cat.id).map((sub) => ({ value: sub.id, label: `↳ ${sub.name}` })),
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl border border-border w-full max-w-4xl max-h-[95vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-h3 text-foreground">{post ? "Editar Post" : "Novo Post"}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { playSound("toggle"); setPreview((p) => !p); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? "Editar" : "Preview"}
            </button>
            <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer text-lg leading-none">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Meta fields */}
          <div className="px-5 py-4 border-b border-border space-y-3 shrink-0">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Título do post…"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors text-base font-medium"
            />

            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-label text-muted mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-label text-muted mb-1">Categoria</label>
                <Select
                  value={form.categoryId}
                  onChange={(val) => setForm((f) => ({ ...f, categoryId: val }))}
                  options={categoryOptions}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-label text-muted mb-1">Tipo</label>
                <Select
                  value={form.type}
                  onChange={(val) => setForm((f) => ({ ...f, type: val }))}
                  options={[
                    { value: "article", label: "Artigo" },
                    { value: "guide", label: "Guia" },
                    { value: "list", label: "Lista" },
                    { value: "study", label: "Estudo" },
                  ]}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => { playSound("toggle"); setForm((f) => ({ ...f, isPublished: e.target.checked })); }}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground">Publicado</span>
                </label>
              </div>
            </div>

            <input
              type="text"
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              placeholder="Resumo (opcional)…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
            />

            {/* Cover image */}
            <div>
              <label className="block text-label text-muted mb-1">Imagem de capa</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.coverImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                  placeholder="URL da imagem ou faça upload…"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {coverUploading ? "Enviando…" : "Upload"}
                </button>
                {form.coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, coverImageUrl: "" }))}
                    className="p-2 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {form.coverImageUrl && (
                <img
                  src={form.coverImageUrl}
                  alt="Capa"
                  className="mt-2 h-20 w-auto rounded-lg border border-border object-cover"
                />
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            {uploadError && (
              <p className="text-sm text-red-500">{uploadError}</p>
            )}
          </div>

          {/* Content editor / preview */}
          <div className="flex-1 overflow-hidden flex flex-col px-5 py-3 gap-2">
            {!preview && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => inlineInputRef.current?.click()}
                  disabled={inlineUploading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {inlineUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  Imagem
                </button>
                <button
                  type="button"
                  onClick={() => inlineInputRef.current?.click()}
                  disabled={inlineUploading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {inlineUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  Arquivo
                </button>
                <span className="text-xs text-muted ml-1">Markdown suportado</span>
                <input
                  ref={inlineInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleInlineUpload}
                />
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {preview ? (
                <div className="h-full overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                    {form.content || <span className="text-muted italic">Sem conteúdo ainda…</span>}
                  </pre>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Escreva o conteúdo em Markdown…"
                  required
                  className="w-full h-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono leading-relaxed"
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border shrink-0">
            {submitError ? (
              <p className="text-sm text-red-500">{submitError}</p>
            ) : <span />}
            <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer disabled:opacity-50">
              {saving ? "Salvando…" : post ? "Salvar alterações" : "Criar post"}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
