import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { leadTag } from "@/lib/db/schema/pipeline";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canView = await checkPermission(session.user.id, userRole, "pipeline", "view");
  if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const tags = await db.select().from(leadTag).orderBy(leadTag.name);
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
  if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const { name, color } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [tag] = await db.insert(leadTag).values({ name: name.trim(), color: color ?? "#6366f1" }).returning();
  return NextResponse.json(tag, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canDelete = await checkPermission(session.user.id, userRole, "pipeline", "delete");
  if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  await db.delete(leadTag).where(eq(leadTag.id, id));
  return NextResponse.json({ ok: true });
}
