import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { client, clientResponsible } from "@/lib/db/schema/clients";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

const createClientSchema = z.object({
  companyName: z.string().min(1, "Nome da empresa obrigatório").max(255),
  cnpj: z.string().optional().nullable(),
  responsibleName: z.string().min(1, "Nome do responsável obrigatório").max(255),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "clients", "view");
    if (!canView) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const tenantId = await getTenantId(request.headers);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");

    const conditions = [eq(client.tenantId, tenantId)];
    if (search) {
      const orCondition = or(
        ilike(client.companyName, `%${search}%`),
        ilike(client.responsibleName, `%${search}%`)
      );
      if (orCondition) conditions.push(orCondition);
    }
    if (status && (status === "active" || status === "inactive")) {
      conditions.push(eq(client.status, status));
    }

    const clients = await db
      .select({
        id: client.id,
        companyName: client.companyName,
        cnpj: client.cnpj,
        responsibleName: client.responsibleName,
        email: client.email,
        phone: client.phone,
        status: client.status,
        groupId: client.groupId,
        notes: client.notes,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      })
      .from(client)
      .where(and(...conditions))
      .orderBy(desc(client.createdAt));

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("[CLIENTS] GET failed:", { operation: "list" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const tenantId = await getTenantId(request.headers);
    const [newClient] = await db
      .insert(client)
      .values({
        tenantId,
        companyName: data.companyName,
        cnpj: data.cnpj ?? null,
        responsibleName: data.responsibleName,
        email: data.email || null,
        phone: data.phone ?? null,
        groupId: data.groupId ?? null,
        status: data.status,
        notes: data.notes ?? null,
      })
      .returning();

    // Auto-assign creator as responsible
    await db.insert(clientResponsible).values({
      clientId: newClient.id,
      userId: session.user.id,
      role: "responsible",
    });

    return NextResponse.json({ client: newClient }, { status: 201 });
  } catch (error) {
    console.error("[CLIENTS] POST failed:", { operation: "create" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
