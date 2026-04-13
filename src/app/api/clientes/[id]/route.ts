import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { client, clientFile, clientResponsible } from "@/lib/db/schema/clients";
import { contract } from "@/lib/db/schema/contracts";
import { user } from "@/lib/db/schema/users";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateClientSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  cnpj: z.string().optional().nullable(),
  responsibleName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "clients", "view");
    if (!canView) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const [clientData] = await db
      .select()
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!clientData) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const [files, responsibles, contracts] = await Promise.all([
      db.select().from(clientFile).where(eq(clientFile.clientId, id)),
      db
        .select({
          id: clientResponsible.id,
          userId: clientResponsible.userId,
          role: clientResponsible.role,
          userName: user.name,
          userEmail: user.email,
        })
        .from(clientResponsible)
        .innerJoin(user, eq(clientResponsible.userId, user.id))
        .where(eq(clientResponsible.clientId, id)),
      db
        .select()
        .from(contract)
        .where(eq(contract.clientId, id)),
    ]);

    return NextResponse.json({ client: clientData, files, responsibles, contracts });
  } catch (error) {
    console.error("[CLIENTS] GET by id failed:", { operation: "get" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "clients", "edit");
    if (!canEdit) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (updates.email === "") updates.email = null;

    const [updated] = await db
      .update(client)
      .set(updates)
      .where(eq(client.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ client: updated });
  } catch (error) {
    console.error("[CLIENTS] PATCH failed:", { operation: "update" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canDelete = await checkPermission(session.user.id, userRole, "clients", "delete");
    if (!canDelete) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const [deleted] = await db
      .delete(client)
      .where(eq(client.id, id))
      .returning({ id: client.id });

    if (!deleted) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLIENTS] DELETE failed:", { operation: "delete" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
