import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { financialConfig } from "@/lib/db/schema/financial";
import { desc, eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  partnerSharePercentage: z.coerce.number().min(0).max(100).optional(),
  companyReservePercentage: z.coerce.number().min(0).max(100).optional(),
  revenueGoal: z.coerce.number().min(0).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "financial", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const tenantId = await getTenantId(request.headers);

    const [config] = await db
      .select()
      .from(financialConfig)
      .where(eq(financialConfig.tenantId, tenantId))
      .orderBy(desc(financialConfig.updatedAt))
      .limit(1);

    return NextResponse.json({
      config: config ?? {
        partnerSharePercentage: "30.00",
        companyReservePercentage: "10.00",
        revenueGoal: null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    // Editar config: sócio AMS legado OU admin/superadmin do tenant atual.
    const canEdit = await checkPermission(session.user.id, userRole, "financial", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const tenantId = await getTenantId(request.headers);

    // Get current config to merge with partial updates
    const [current] = await db
      .select()
      .from(financialConfig)
      .where(eq(financialConfig.tenantId, tenantId))
      .orderBy(desc(financialConfig.updatedAt))
      .limit(1);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const [config] = await db
      .insert(financialConfig)
      .values({
        tenantId,
        partnerSharePercentage: String(parsed.data.partnerSharePercentage ?? Number(current?.partnerSharePercentage ?? 30)),
        companyReservePercentage: String(parsed.data.companyReservePercentage ?? Number(current?.companyReservePercentage ?? 10)),
        revenueGoal: parsed.data.revenueGoal != null ? String(parsed.data.revenueGoal) : (current?.revenueGoal ?? null),
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
