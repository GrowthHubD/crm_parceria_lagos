import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["partner", "manager", "operational"]).optional(),
  jobTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "admin", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // Prevent demoting yourself
    if (id === session.user.id) {
      return NextResponse.json({ error: "Não é possível editar sua própria conta por aqui" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) updates.name = d.name;
    if (d.role !== undefined) updates.role = d.role;
    if (d.jobTitle !== undefined) updates.jobTitle = d.jobTitle;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.isActive !== undefined) updates.isActive = d.isActive;

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ user: updated });
  } catch {
    console.error("[ADMIN] PATCH user failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
