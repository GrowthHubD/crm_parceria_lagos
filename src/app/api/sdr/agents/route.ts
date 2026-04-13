import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { sdrAgent } from "@/lib/db/schema/sdr";
import { eq, asc } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "sdr", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const agents = await db.select().from(sdrAgent).orderBy(asc(sdrAgent.name));
    return NextResponse.json({ agents });
  } catch {
    console.error("[SDR] GET agents failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "sdr", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const [agent] = await db.insert(sdrAgent).values(parsed.data).returning();
    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    console.error("[SDR] POST agent failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
