"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  pipeline: "Pipeline",
  contratos: "Contratos",
  financeiro: "Financeiro",
  crm: "CRM",
  clientes: "Clientes",
  sdr: "Agente SDR",
  kanban: "Kanban",
  blog: "Blog",
  admin: "Admin",
  usuarios: "Usuários",
  configuracoes: "Configurações",
  permissoes: "Permissões",
  notificacoes: "Notificações",
  novo: "Novo",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumbs">
        <span className="text-sm font-medium text-foreground">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        className="text-muted hover:text-foreground transition-colors duration-200 cursor-pointer"
      >
        Dashboard
      </Link>

      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const label =
          ROUTE_LABELS[segment] || decodeURIComponent(segment);

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted/50" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-muted hover:text-foreground transition-colors duration-200 cursor-pointer"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
