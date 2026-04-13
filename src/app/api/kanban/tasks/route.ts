import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { kanbanTask, kanbanColumn } from "@/lib/db/schema/kanban";
import { userGoogleIntegration } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import { createCalendarEvent } from "@/lib/google-calendar";
import type { UserRole } from "@/types";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  columnId: z.string().uuid(),
  assignedTo: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  leadId: z.string().uuid().optional().nullable(),
  syncCalendar: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "kanban", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;

    const [col] = await db
      .select({ id: kanbanColumn.id })
      .from(kanbanColumn)
      .where(eq(kanbanColumn.id, d.columnId))
      .limit(1);
    if (!col) return NextResponse.json({ error: "Coluna não encontrada" }, { status: 404 });

    const [task] = await db
      .insert(kanbanTask)
      .values({
        title: d.title,
        description: d.description ?? null,
        columnId: d.columnId,
        assignedTo: d.assignedTo,
        dueDate: d.dueDate ?? null,
        priority: d.priority,
        leadId: d.leadId ?? null,
        createdBy: session.user.id,
      })
      .returning();

    // Sync to Google Calendar if requested and task has a due date
    if (task.dueDate && d.syncCalendar) {
      const [integration] = await db
        .select({ googleCalendarId: userGoogleIntegration.googleCalendarId })
        .from(userGoogleIntegration)
        .where(eq(userGoogleIntegration.userId, d.assignedTo))
        .limit(1);

      if (integration) {
        const eventId = await createCalendarEvent(d.assignedTo, integration.googleCalendarId, {
          title: d.title,
          description: d.description ?? null,
          dueDate: task.dueDate,
          priority: d.priority,
        });

        if (eventId) {
          await db
            .update(kanbanTask)
            .set({ googleCalendarEventId: eventId })
            .where(eq(kanbanTask.id, task.id));
          task.googleCalendarEventId = eventId;
        }
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch {
    console.error("[KANBAN] POST task failed:", { operation: "create" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
