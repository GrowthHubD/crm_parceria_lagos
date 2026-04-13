"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useUiSound } from "@/hooks/use-ui-sound";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { playSound } = useUiSound();

  useEffect(() => {
    if (open) playSound(variant === "danger" ? "error" : "pop");
  }, [open, variant, playSound]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto animate-shake ${
            variant === "danger" ? "bg-error/10" : "bg-warning/10"
          }`}
        >
          <AlertTriangle
            className={`w-6 h-6 ${variant === "danger" ? "text-error" : "text-warning"}`}
          />
        </div>

        {title && (
          <h2 className="text-base font-semibold text-foreground text-center mb-2">{title}</h2>
        )}
        <p className="text-sm text-muted text-center mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={() => { playSound("click"); onCancel(); }}
            className="flex-1 py-2 px-4 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-all active:scale-95 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { playSound("delete"); onConfirm(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all active:scale-95 cursor-pointer ${
              variant === "danger"
                ? "bg-error hover:bg-error/90"
                : "bg-warning hover:bg-warning/90 text-background"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
