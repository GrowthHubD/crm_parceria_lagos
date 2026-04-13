"use client";

import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "info";
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const listeners = new Set<(toast: Toast) => void>();

export function toast(message: string, type: ToastType = "info") {
  const t: Toast = { id: Math.random().toString(36).substring(2), type, message };
  listeners.forEach((l) => l(t));
}

toast.success = (m: string) => toast(m, "success");
toast.error = (m: string) => toast(m, "error");
toast.info = (m: string) => toast(m, "info");

export function useToastListener() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handle = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter(x => x.id !== t.id)), 4000);
    };
    listeners.add(handle);
    return () => { listeners.delete(handle); };
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter(x => x.id !== id));
  return { toasts, removeToast };
}
