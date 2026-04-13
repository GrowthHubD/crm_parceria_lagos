import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema/notifications";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const [updated] = await db
      .update(notification)
      .set({ isRead: true })
      .where(and(eq(notification.id, id), eq(notification.userId, session.user.id)))
      .returning({ id: notification.id });

    if (!updated) return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    console.error("[NOTIF] PATCH failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
