import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getUserModules } from "@/lib/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let tenantCtx;
  try {
    tenantCtx = await getTenantContext(await headers());
  } catch {
    redirect("/login");
  }

  const userRole = tenantCtx.role as UserRole;
  const allowedModules = await getUserModules(
    tenantCtx.userId,
    userRole,
    tenantCtx
  );

  // Buscar nome e imagem do user via auth
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  const userName = session?.user?.name ?? "Usuário";
  const userImage = session?.user?.image ?? null;

  return (
    <DashboardShell
      allowedModules={allowedModules}
      isPlatformOwner={tenantCtx.isPlatformOwner}
      tenantSlug={tenantCtx.tenantSlug}
      userName={userName}
      userImage={userImage}
      userRole={userRole}
    >
      {children}
    </DashboardShell>
  );
}
