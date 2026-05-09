"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, Check, ChevronDown, Loader2, ShieldCheck, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailableTenant } from "@/types";

interface Props {
  tenants: AvailableTenant[];
  currentTenantId: string;
  collapsed?: boolean;
  onSwitch?: () => void;
}

export function TenantSwitcher({ tenants, currentTenantId, collapsed, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = tenants.find((t) => t.id === currentTenantId) ?? tenants[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSelect(tenantId: string) {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(tenantId);
    setError(null);
    try {
      const res = await fetch("/api/tenant/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      // Limpa cache do tenant-ctx pra forçar refetch no layout
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k?.startsWith("tenant-ctx:")) sessionStorage.removeItem(k);
        }
      } catch { /* ignore */ }

      onSwitch?.();
      setOpen(false);
      // Hard reload — server components precisam re-renderizar com novo tenant
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar tenant");
      setSwitching(null);
    }
  }

  if (!current) return null;

  if (collapsed) {
    return (
      <div className="px-2 py-2" ref={containerRef}>
        <button
          onClick={() => setOpen(!open)}
          title={`Tenant: ${current.slug}`}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-surface-2 hover:bg-surface-2/70 text-foreground transition-colors"
        >
          <Building2 className="w-4 h-4" />
        </button>
        {open && (
          <DropdownPanel
            tenants={tenants}
            currentTenantId={currentTenantId}
            switching={switching}
            error={error}
            onSelect={handleSelect}
            anchorClassName="left-12 top-2 w-56"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative px-2 pt-2" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
          "bg-surface-2 hover:bg-surface-2/70 text-foreground transition-colors",
          "border border-border/60"
        )}
      >
        <Building2 className="w-4 h-4 text-muted shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-muted/70 leading-none">Tenant ativo</p>
          <p className="text-sm font-medium truncate mt-0.5">{current.slug}</p>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <DropdownPanel
          tenants={tenants}
          currentTenantId={currentTenantId}
          switching={switching}
          error={error}
          onSelect={handleSelect}
          anchorClassName="left-2 right-2 mt-1"
        />
      )}
    </div>
  );
}

function DropdownPanel({
  tenants,
  currentTenantId,
  switching,
  error,
  onSelect,
  anchorClassName,
}: {
  tenants: AvailableTenant[];
  currentTenantId: string;
  switching: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  anchorClassName: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-[200] rounded-lg border border-border/60 bg-[#0F172A] shadow-2xl backdrop-blur-xl p-1 max-h-80 overflow-auto",
        anchorClassName
      )}
    >
      {error && (
        <p className="text-xs text-destructive px-2 py-1.5">{error}</p>
      )}
      {tenants.map((t) => {
        const active = t.id === currentTenantId;
        const isSwitching = switching === t.id;
        return (
          <button
            key={t.id}
            disabled={!!switching}
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-slate-200 hover:bg-[#1E293B] hover:text-white",
              switching && "opacity-60 cursor-not-allowed"
            )}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">{t.slug}</span>
            {t.isPlatformOwner && (
              <span title="Platform" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" /> GH
              </span>
            )}
            {t.isPartner && (
              <span title="Partner" className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 flex items-center gap-0.5">
                <Handshake className="w-3 h-3" /> Partner
              </span>
            )}
            {isSwitching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : active ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
