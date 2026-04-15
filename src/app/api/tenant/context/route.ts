import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getUserModules } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const tenantCtx = await getTenantContext(request.headers);
    const userRole = tenantCtx.role as UserRole;
    const modules = await getUserModules(tenantCtx.userId, userRole, tenantCtx);

    return NextResponse.json({
      tenantId: tenantCtx.tenantId,
      tenantSlug: tenantCtx.tenantSlug,
      isPlatformOwner: tenantCtx.isPlatformOwner,
      role: tenantCtx.role,
      modules,
      userName: session.user.name,
      userImage: session.user.image ?? null,
    });
  } catch {
    return NextResponse.json({ error: "NO_TENANT_ACCESS" }, { status: 403 });
  }
}
