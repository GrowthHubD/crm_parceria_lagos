import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { blogCategory } from "@/lib/db/schema/blog";
import { asc, eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "blog", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const tenantId = await getTenantId(request.headers);
    const categories = await db
      .select()
      .from(blogCategory)
      .where(eq(blogCategory.tenantId, tenantId))
      .orderBy(asc(blogCategory.order), asc(blogCategory.name));

    return NextResponse.json({ categories });
  } catch {
    console.error("[BLOG] GET categories failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "blog", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const tenantId = await getTenantId(request.headers);
    const [category] = await db
      .insert(blogCategory)
      .values({ tenantId, ...parsed.data })
      .returning();
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    console.error("[BLOG] POST category failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
