import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user, session as sessionTable } from "@/lib/db/schema/users";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { messageTemplate } from "@/lib/db/schema/settings";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢",
};

const DEFAULT_DAILY_TEMPLATE =
  "📋 *Tarefas de hoje, {{data}}*\n\nOlá, {{nome}}! Você tem {{qtd}} tarefa(s) para hoje:\n\n{{tarefas}}\n\n_Growth Hub Manager_";

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`{{${key}}}`, val),
    template
  );
}

// Called by Cloudflare Cron Trigger: "0 7 * * *" (daily 7h UTC)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayFormatted = format(new Date(), "dd 'de' MMMM", { locale: ptBR });

    const dueTasks = await db
      .select({
        id: kanbanTask.id,
        tenantId: kanbanTask.tenantId,
        title: kanbanTask.title,
        priority: kanbanTask.priority,
        assignedTo: kanbanTask.assignedTo,
        assigneeName: user.name,
        assigneePhone: user.phone,
      })
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(
        and(
          eq(kanbanTask.dueDate, today),
          eq(kanbanTask.isCompleted, false)
        )
      );

    if (dueTasks.length === 0) {
      return NextResponse.json({ sent: 0, message: "No tasks due today" });
    }

    const fallbackBaseUrl = process.env.UAZAPI_BASE_URL;
    const groupJid = process.env.REMINDER_GROUP_JID ?? "";

    // Agrupar por tenant primeiro — cada tenant usa SEU próprio whatsapp_number
    const byTenant = new Map<string, typeof dueTasks>();
    for (const t of dueTasks) {
      if (!byTenant.has(t.tenantId)) byTenant.set(t.tenantId, []);
      byTenant.get(t.tenantId)!.push(t);
    }

    let sentCount = 0;
    const skippedTenants: string[] = [];

    for (const [tenantId, tenantTasks] of byTenant) {
      const [wNum] = await db
        .select()
        .from(whatsappNumber)
        .where(and(eq(whatsappNumber.tenantId, tenantId), eq(whatsappNumber.isActive, true)))
        .limit(1);

      // Server URL da própria row do tenant — fallback pro env
      const baseUrl = wNum?.serverUrl || fallbackBaseUrl;

      if (!baseUrl || !wNum) {
        skippedTenants.push(tenantId);
        continue;
      }

      // Template do tenant ou fallback
      let templateBody = DEFAULT_DAILY_TEMPLATE;
      try {
        const [tmpl] = await db
          .select({ body: messageTemplate.body })
          .from(messageTemplate)
          .where(and(eq(messageTemplate.id, "daily_reminder"), eq(messageTemplate.tenantId, tenantId)))
          .limit(1);
        if (tmpl) templateBody = tmpl.body;
      } catch { /* tabela ausente — fallback */ }

      const byUser = new Map<string, { name: string; phone: string | null; tasks: typeof tenantTasks }>();
      for (const task of tenantTasks) {
        if (!byUser.has(task.assignedTo)) {
          byUser.set(task.assignedTo, { name: task.assigneeName, phone: task.assigneePhone, tasks: [] });
        }
        byUser.get(task.assignedTo)!.tasks.push(task);
      }

      for (const [, data] of byUser) {
        if (!data.phone) continue;

        const taskLines = data.tasks
          .map((t) => `${PRIORITY_EMOJI[t.priority] ?? "•"} ${t.title}`)
          .join("\n");

        const message = applyTemplate(templateBody, {
          nome: data.name.split(" ")[0],
          data: todayFormatted,
          qtd: String(data.tasks.length),
          tarefas: taskLines,
        });

        if (groupJid) {
          const fullMessage = `@${data.phone}\n${message}`;
          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${wNum.uazapiToken}`,
            },
            body: JSON.stringify({
              phone: groupJid,
              message: fullMessage,
              mentionedJid: [`${data.phone}@s.whatsapp.net`],
            }),
          }).catch(() => null);
        } else {
          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${wNum.uazapiToken}`,
            },
            body: JSON.stringify({ phone: data.phone, message }),
          }).catch(() => null);
        }

        sentCount++;
      }
    }

    for (const task of dueTasks) {
      await db.update(kanbanTask).set({ whatsappSent: true }).where(eq(kanbanTask.id, task.id));
    }

    return NextResponse.json({
      sent: sentCount,
      tasks: dueTasks.length,
      tenants: byTenant.size,
      skippedTenants,
      mode: groupJid ? "group" : "individual",
    });
  } catch (error) {
    console.error("[CRON] kanban-daily failed:", { operation: "daily_dispatch" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
