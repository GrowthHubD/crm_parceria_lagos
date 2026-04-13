"use client";

import { useToastListener } from "@/hooks/use-toast";
import { useUiSound } from "@/hooks/use-ui-sound";
import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, removeToast } = useToastListener();
  const { playSound } = useUiSound();

  useEffect(() => {
    if (toasts.length > 0) {
      const last = toasts[toasts.length - 1];
      if (last.type === "success") playSound("success");
      else if (last.type === "error") playSound("error");
      else playSound("pop");
    }
  }, [toasts, playSound]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-lg border p-4 shadow-xl backdrop-blur-xl animate-in slide-in-from-right-5 fade-in duration-300 min-w-[280px]",
          t.type === "success" && "bg-surface-2/90 border-success/30",
          t.type === "error" && "bg-surface-2/90 border-error/30 text-error",
          t.type === "info" && "bg-surface-2/90 border-border"
        )}>
          {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-success" />}
          {t.type === "error" && <XCircle className="h-5 w-5 text-error" />}
          {t.type === "info" && <AlertCircle className="h-5 w-5 text-muted" />}
          <p className="text-sm font-medium text-foreground">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="ml-auto p-1 hover:text-foreground text-muted transition-colors cursor-pointer">
             <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
