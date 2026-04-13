"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, FileText, ExternalLink, Trash2, Upload } from "lucide-react";
import { Select } from "@/components/ui/select";

interface ContractFormData {
  clientId: string;
  companyName: string;
  monthlyValue: string;
  implementationValue: string;
  type: "monthly" | "annual";
  startDate: string;
  endDate: string;
  paymentDay: string;
  status: "active" | "expiring" | "inactive";
  notes: string;
}

interface ClientOption {
  id: string;
  companyName: string;
}

interface ContractFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<ContractFormData> & { id?: string; driveFileId?: string | null; driveWebViewLink?: string | null };
  mode?: "create" | "edit";
  clients: ClientOption[];
}

const EMPTY_FORM: ContractFormData = {
  clientId: "",
  companyName: "",
  monthlyValue: "",
  implementationValue: "",
  type: "monthly",
  startDate: "",
  endDate: "",
  paymentDay: "",
  status: "active",
  notes: "",
};

export function ContractFormModal({
  open,
  onClose,
  onSuccess,
  initialData,
  mode = "create",
  clients,
}: ContractFormModalProps) {
  const [form, setForm] = useState<ContractFormData>({ ...EMPTY_FORM, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string>(initialData?.driveFileId ?? "");

  // When client changes, auto-fill company name
  useEffect(() => {
    if (mode === "create" && form.clientId) {
      const selectedClient = clients.find((c) => c.id === form.clientId);
      if (selectedClient) {
        setForm((prev) => ({ ...prev, companyName: selectedClient.companyName }));
      }
    }
  }, [form.clientId, clients, mode]);

  if (!open) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = mode === "edit" && initialData?.id
        ? `/api/contratos/${initialData.id}`
        : "/api/contratos";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId || undefined,
          companyName: form.companyName,
          monthlyValue: parseFloat(form.monthlyValue) || 0,
          implementationValue: form.implementationValue ? parseFloat(form.implementationValue) : null,
          type: form.type,
          startDate: form.startDate,
          endDate: form.endDate || null,
          paymentDay: form.paymentDay ? parseInt(form.paymentDay) : null,
          status: form.status,
          driveFileId: fileUrl.trim() || null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao salvar contrato");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof ContractFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">
            {mode === "edit" ? "Editar Contrato" : "Novo Contrato"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mode === "create" && (
              <div className="sm:col-span-2">
                <label className="text-label text-muted block mb-1.5">
                  Cliente <span className="text-error">*</span>
                </label>
                <Select
                  value={form.clientId}
                  onChange={(val) => setForm((p) => ({ ...p, clientId: val }))}
                  placeholder="Selecione o cliente..."
                  options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">
                Nome no Contrato <span className="text-error">*</span>
              </label>
              <input type="text" value={form.companyName} onChange={set("companyName")} required
                placeholder="Nome da empresa no contrato"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">
                Valor Mensal (R$) <span className="text-error">*</span>
              </label>
              <input type="number" step="0.01" min="0" value={form.monthlyValue} onChange={set("monthlyValue")} required
                placeholder="0,00"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Implantação (R$)</label>
              <input type="number" step="0.01" min="0" value={form.implementationValue} onChange={set("implementationValue")}
                placeholder="0,00"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Tipo</label>
              <Select value={form.type} onChange={(val) => setForm((p) => ({ ...p, type: val as "monthly" | "annual" }))} options={[
                { value: "monthly", label: "Mensal" },
                { value: "annual", label: "Anual" },
              ]} />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Dia de Pagamento</label>
              <input type="number" min="1" max="31" value={form.paymentDay} onChange={set("paymentDay")}
                placeholder="Ex: 10"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">
                Início <span className="text-error">*</span>
              </label>
              <input type="date" value={form.startDate} onChange={set("startDate")} required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Término</label>
              <input type="date" value={form.endDate} onChange={set("endDate")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>

            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">Status</label>
              <Select value={form.status} onChange={(val) => setForm((p) => ({ ...p, status: val as "active" | "expiring" | "inactive" }))} options={[
                { value: "active", label: "Ativo" },
                { value: "expiring", label: "A Vencer" },
                { value: "inactive", label: "Inativo" },
              ]} />
            </div>

            {/* ── Arquivo do contrato ── */}
            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">Arquivo do Contrato</label>

              {fileUrl ? (
                <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-success shrink-0" />
                    <span className="text-sm text-success font-medium">Arquivo enviado</span>
                  </div>
                  <div className="flex gap-1">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded text-success hover:bg-success/10 transition-colors cursor-pointer" title="Abrir arquivo">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button type="button" onClick={() => { setFileUrl(""); setSelectedFile(null); }}
                      className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer" title="Remover">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-5 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <Upload className="w-5 h-5 text-muted" />
                    <div className="text-center">
                      <p className="text-sm text-muted">
                        {selectedFile
                          ? <span className="text-foreground font-medium">{selectedFile.name}</span>
                          : <>Clique para selecionar o arquivo</>}
                      </p>
                      <p className="text-xs text-muted/60 mt-0.5">PDF, Word ou imagem — máx. 20 MB</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setUploadError(null); }}
                      className="hidden" />
                  </div>

                  {uploadError && <p className="text-xs text-error">{uploadError}</p>}

                  {selectedFile && (
                    <button type="button" disabled={uploading}
                      onClick={async () => {
                        setUploading(true); setUploadError(null);
                        try {
                          const fd = new FormData();
                          fd.append("file", selectedFile);
                          const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (!res.ok) { setUploadError(data.error ?? "Erro ao enviar"); return; }
                          setFileUrl(data.url);
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        } finally { setUploading(false); }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer">
                      {uploading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                        : <><Upload className="w-4 h-4" /> Fazer Upload</>}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">Observações</label>
              <textarea value={form.notes} onChange={set("notes")} rows={3}
                placeholder="Informações adicionais..."
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground/20 transition-colors text-sm cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar Alterações" : "Criar Contrato"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
