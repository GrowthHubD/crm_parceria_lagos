import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { blogPost, blogCategory } from "@/lib/db/schema/blog";
import { user } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().optional().nullable(),
  type: z.enum(["list", "article", "guide", "study"]).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid().optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "blog", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [post] = await db
      .select({
        id: blogPost.id,
        title: blogPost.title,
        slug: blogPost.slug,
        content: blogPost.content,
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
      .where(eq(blogPost.id, id))
      .limit(1);

    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    return NextResponse.json({ post });
  } catch {
    console.error("[BLOG] GET post failed");
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
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "blog", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.title !== undefined) updates.title = d.title;
    if (d.slug !== undefined) updates.slug = d.slug;
    if (d.content !== undefined) updates.content = d.content;
    if (d.excerpt !== undefined) updates.excerpt = d.excerpt;
    if (d.type !== undefined) updates.type = d.type;
    if (d.coverImageUrl !== undefined) updates.coverImageUrl = d.coverImageUrl;
    if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
    if (d.isPublished !== undefined) {
      updates.isPublished = d.isPublished;
      if (d.isPublished) updates.publishedAt = new Date();
    }

    const [updated] = await db
      .update(blogPost)
      .set(updates)
      .where(eq(blogPost.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    return NextResponse.json({ post: updated });
  } catch {
    console.error("[BLOG] PATCH post failed");
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
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canDelete = await checkPermission(session.user.id, userRole, "blog", "delete");
    if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [deleted] = await db
      .delete(blogPost)
      .where(eq(blogPost.id, id))
      .returning({ id: blogPost.id });

    if (!deleted) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    console.error("[BLOG] DELETE post failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
