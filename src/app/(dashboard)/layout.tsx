"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Loader2 } from "lucide-react";
import type { AvailableTenant, SystemModule, UserRole } from "@/types";

const isDev = process.env.NODE_ENV === "development";

interface TenantContext {
  tenantId: string;
  isPlatformOwner: boolean;
  tenantSlug: string;
  role: string;
  modules: SystemModule[];
  userName: string;
  userImage: string | null;
  availableTenants?: AvailableTenant[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  // Inicializa do sessionStorage em renderização lazy — evita flash de "Carregando..."
  // ao trocar de aba (next.js client-side nav re-mount pode acontecer em alguns casos).
  const [tenantCtx, setTenantCtx] = useState<TenantContext | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      // Pega qualquer cache de tenant-ctx — se houver vários (raro), o primeiro serve
      // (o useEffect abaixo valida e re-busca se a sessão mudou).
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k?.startsWith("tenant-ctx:")) {
          const v = sessionStorage.getItem(k);
          if (v) return JSON.parse(v) as TenantContext;
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  // Redirecionar pro login apenas em produção
  useEffect(() => {
    if (!isPending && !session && !isDev) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  // Buscar tenant context — cache em sessionStorage pra evitar re-fetch em
  // toda navegação client-side (Next App Router preserva layout entre pages,
  // mas hard reload + abas múltiplas refazem fetch).
  useEffect(() => {
    if (!session && !isDev) return;

    const cacheKey = session?.user?.id ? `tenant-ctx:${session.user.id}` : null;
    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setTenantCtx(JSON.parse(cached));
          return;
        }
      } catch { /* sessionStorage indisponível — segue pro fetch */ }
    }

    fetch("/api/tenant/context")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error ?? `HTTP ${res.status}`;
          const detail = body?.debugMessage ? ` — ${body.debugMessage}` : "";
          const err = new Error(`${code}${detail}`);
          (err as Error & { status?: number }).status = res.status;
          throw err;
        }
        return res.json();
      })
      .then((ctx) => {
        if (cacheKey) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(ctx)); } catch { /* quota / disabled */ }
        }
        setTenantCtx(ctx);
      })
      .catch((err: Error & { status?: number }) => {
        // 401 = não autenticado → /login. Outros erros → mostra mensagem.
        if (err.status === 401) {
          if (!isDev) router.push("/login");
        } else {
          setLoadError(err.message ?? "Erro desconhecido");
        }
      });
  }, [session, router]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full space-y-3">
          <h2 className="font-semibold text-foreground">Erro ao carregar contexto</h2>
          <p className="text-small text-muted">
            Login OK, mas o backend rejeitou: <span className="font-mono text-error">{loadError}</span>
          </p>
          <p className="text-xs text-muted/70">
            Manda esse código pro suporte/dev pra investigar.
          </p>
          <button
            onClick={() => {
              try { sessionStorage.clear(); } catch { /* ignore */ }
              router.push("/login");
            }}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Voltar pro login
          </button>
        </div>
      </div>
    );
  }

  if ((isPending && !isDev) || !tenantCtx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted text-small">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      allowedModules={tenantCtx.modules}
      isPlatformOwner={tenantCtx.isPlatformOwner}
      tenantSlug={tenantCtx.tenantSlug}
      tenantId={tenantCtx.tenantId}
      userName={tenantCtx.userName}
      userImage={tenantCtx.userImage}
      userRole={tenantCtx.role as UserRole}
      availableTenants={tenantCtx.availableTenants}
    >
      {children}
    </DashboardShell>
  );
}
