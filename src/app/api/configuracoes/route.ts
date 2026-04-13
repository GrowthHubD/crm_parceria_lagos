import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user, userGoogleIntegration } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";

/** GET — return current user profile + Google integration status */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const [profile] = await db
      .select({ id: user.id, name: user.name, email: user.email, phone: user.phone, jobTitle: user.jobTitle })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    // Google integration query may fail if table not yet migrated — treat as not connected
    let googleIntegration = null;
    try {
      const [row] = await db
        .select({ googleEmail: userGoogleIntegration.googleEmail, googleCalendarId: userGoogleIntegration.googleCalendarId })
        .from(userGoogleIntegration)
        .where(eq(userGoogleIntegration.userId, session.user.id))
        .limit(1);
      googleIntegration = row ?? null;
    } catch {
      // Table doesn't exist yet — needs db:push
    }

    return NextResponse.json({
      profile: profile ?? null,
      googleCalendar: googleIntegration,
    });
  } catch (error) {
    console.error("[CONFIGURACOES] GET failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** PATCH — update user phone / name / jobTitle */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.phone === "string") {
      // Normalize to digits only (accepts +55 (11) 99999-9999 → 5511999999999)
      const digits = body.phone.replace(/\D/g, "");
      updates.phone = digits || null;
    }
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.jobTitle === "string") updates.jobTitle = body.jobTitle || null;

    await db.update(user).set(updates).where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONFIGURACOES] PATCH failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** DELETE — disconnect Google Calendar */
export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    try {
      await db
        .delete(userGoogleIntegration)
        .where(eq(userGoogleIntegration.userId, session.user.id));
    } catch {
      // Table doesn't exist yet
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONFIGURACOES] DELETE failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
