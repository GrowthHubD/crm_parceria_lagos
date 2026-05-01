import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getTenantId } from "@/lib/tenant";
import { db } from "@/lib/db";
import { blogPost, blogCategory } from "@/lib/db/schema/blog";
import { user } from "@/lib/db/schema/users";
import { eq, desc, and } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  excerpt: z.string().optional().nullable(),
  type: z.enum(["list", "article", "guide", "study"]).default("article"),
  coverImageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid(),
  isPublished: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "blog", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const tenantId = await getTenantId(request.headers);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const publishedOnly = searchParams.get("published") === "true";

    const conditions = [eq(blogPost.tenantId, tenantId)];
    if (categoryId) conditions.push(eq(blogPost.categoryId, categoryId));
    if (publishedOnly) conditions.push(eq(blogPost.isPublished, true));

    const posts = await db
      .select({
        id: blogPost.id,
        title: blogPost.title,
        slug: blogPost.slug,
        excerpt: blogPost.excerpt,
        type: blogPost.type,
        coverImageUrl: blogPost.coverImageUrl,
        categoryId: blogPost.categoryId,
        categoryName: blogCategory.name,
        categorySlug: blogCategory.slug,
        authorId: blogPost.authorId,
        authorName: user.name,
        isPublished: blogPost.isPublished,
        publishedAt: blogPost.publishedAt,
        createdAt: blogPost.createdAt,
        updatedAt: blogPost.updatedAt,
      })
      .from(blogPost)
      .leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
      .leftJoin(user, eq(blogPost.authorId, user.id))
      .where(and(...conditions))
      .orderBy(desc(blogPost.updatedAt));

    return NextResponse.json({ posts });
  } catch {
    console.error("[BLOG] GET posts failed");
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

    const d = parsed.data;
    const tenantId = await getTenantId(request.headers);

    // Valida que a categoria pertence ao tenant atual.
    const [cat] = await db
      .select({ id: blogCategory.id })
      .from(blogCategory)
      .where(and(eq(blogCategory.id, d.categoryId), eq(blogCategory.tenantId, tenantId)))
      .limit(1);
    if (!cat) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });

    const [post] = await db
      .insert(blogPost)
      .values({
        tenantId,
        title: d.title,
        slug: d.slug,
        content: d.content,
        excerpt: d.excerpt ?? null,
        type: d.type,
        coverImageUrl: d.coverImageUrl ?? null,
        categoryId: d.categoryId,
        authorId: session.user.id,
        isPublished: d.isPublished,
        publishedAt: d.isPublished ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    console.error("[BLOG] POST post failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
