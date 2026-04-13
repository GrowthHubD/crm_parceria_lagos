"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { SystemModule, UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  allowedModules: SystemModule[];
  isPlatformOwner: boolean;
  tenantSlug: string;
  userName: string;
  userImage?: string | null;
  userRole: UserRole;
}

export function DashboardShell({
  children,
  allowedModules,
  isPlatformOwner,
  userName,
  userImage,
  userRole,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        allowedModules={allowedModules}
        isPlatformOwner={isPlatformOwner}
        userName={userName}
        userRole={userRole}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-200"
        style={{
          marginLeft: sidebarCollapsed
            ? "var(--sidebar-collapsed)"
            : "var(--sidebar-width)",
        }}
      >
        <Topbar
          userName={userName}
          userImage={userImage ?? undefined}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-[1440px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          div[style*="marginLeft"] {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
