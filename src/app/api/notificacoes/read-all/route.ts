import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema/notifications";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    await db
      .update(notification)
      .set({ isRead: true })
      .where(and(eq(notification.userId, session.user.id), eq(notification.isRead, false)));

    return NextResponse.json({ success: true });
  } catch {
    console.error("[NOTIF] read-all failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
