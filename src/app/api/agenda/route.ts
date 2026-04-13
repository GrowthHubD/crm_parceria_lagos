import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user, userGoogleIntegration } from "@/lib/db/schema/users";
import { eq, and, gte, lte } from "drizzle-orm";
import { listCalendarEvents } from "@/lib/google-calendar";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const targetUserId = searchParams.get("userId") ?? session.user.id;

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;

    // Operational/manager can only view their own calendar
    const viewingUserId = userRole === "partner" ? targetUserId : session.user.id;

    // Date range for the month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Kanban tasks in date range
    const tasks = await db
      .select({
        id: kanbanTask.id,
        title: kanbanTask.title,
        dueDate: kanbanTask.dueDate,
        priority: kanbanTask.priority,
        isCompleted: kanbanTask.isCompleted,
        assigneeName: user.name,
      })
      .from(kanbanTask)
      .leftJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(
        and(
          eq(kanbanTask.assignedTo, viewingUserId),
          gte(kanbanTask.dueDate, startStr),
          lte(kanbanTask.dueDate, endStr)
        )
      );

    // Google Calendar events (best-effort — table may not exist before db:push)
    let googleEvents: object[] = [];
    let hasCalendar = false;
    try {
      const [integration] = await db
        .select({ googleCalendarId: userGoogleIntegration.googleCalendarId })
        .from(userGoogleIntegration)
        .where(eq(userGoogleIntegration.userId, viewingUserId))
        .limit(1);

      if (integration) {
        hasCalendar = true;
        try {
          googleEvents = await listCalendarEvents(
            viewingUserId,
            integration.googleCalendarId,
            `${startStr}T00:00:00Z`,
            `${endStr}T23:59:59Z`
          );
        } catch {
          // Token expired or API error — skip
        }
      }
    } catch {
      // Table doesn't exist yet — needs db:push
    }

    // Partners can view any team member
    let teamUsers: { id: string; name: string }[] = [];
    if (userRole === "partner") {
      teamUsers = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.isActive, true));
    }

    return NextResponse.json({ tasks, googleEvents, hasCalendar, teamUsers, viewingUserId });
  } catch (error) {
    console.error("[AGENDA] GET failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
