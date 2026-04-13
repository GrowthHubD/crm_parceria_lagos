import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user } from "@/lib/db/schema/users";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { contract } from "@/lib/db/schema/contracts";
import { messageTemplate } from "@/lib/db/schema/settings";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢",
};

const DEFAULT_WEEKLY_TEMPLATE =
  "📅 *Resumo da semana ({{semana}})*\n\nOlá, {{nome}}! Você tem {{qtd}} tarefa(s) essa semana:\n\n{{tarefas}}\n\n_Growth Hub Manager_";

const DEFAULT_CONTRACT_TEMPLATE =
  "⚠️ *{{qtd}} contrato(s) a vencer em 30 dias:*\n\n{{contratos}}\n\n_Growth Hub Manager_";

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`{{${key}}}`, val),
    template
  );
}

// Called by Cloudflare Cron: "0 7 * * 1" (Monday 7h UTC)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekRange = `${format(now, "dd/MM")} – ${format(addDays(now, 6), "dd/MM")}`;

  try {
    // ─── 1. Weekly kanban digest ───────────────────────────────────
    const weekTasks = await db
      .select({
        id: kanbanTask.id,
        title: kanbanTask.title,
        dueDate: kanbanTask.dueDate,
        priority: kanbanTask.priority,
        assignedTo: kanbanTask.assignedTo,
        assigneeName: user.name,
        assigneePhone: user.phone,
      })
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(
        and(
          gte(kanbanTask.dueDate, weekStart),
          lte(kanbanTask.dueDate, weekEnd),
          eq(kanbanTask.isCompleted, false)
        )
      );

    const byUser = new Map<string, { name: string; phone: string | null; tasks: typeof weekTasks }>();
    for (const task of weekTasks) {
      if (!byUser.has(task.assignedTo)) {
        byUser.set(task.assignedTo, { name: task.assigneeName, phone: task.assigneePhone, tasks: [] });
      }
      byUser.get(task.assignedTo)!.tasks.push(task);
    }

    // ─── 2. Contract expiry alerts ────────────────────────────────
    const in30days = format(addDays(now, 30), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const expiringContracts = await db
      .select({
        id: contract.id,
        companyName: contract.companyName,
        endDate: contract.endDate,
        monthlyValue: contract.monthlyValue,
      })
      .from(contract)
      .where(
        and(
          ne(contract.status, "inactive"),
          gte(contract.endDate!, today),
          lte(contract.endDate!, in30days)
        )
      );

    for (const c of expiringContracts) {
      await db
        .update(contract)
        .set({ status: "expiring" })
        .where(eq(contract.id, c.id));
    }

    // ─── Fetch templates ──────────────────────────────────────────
    let weeklyBody = DEFAULT_WEEKLY_TEMPLATE;
    let contractBody = DEFAULT_CONTRACT_TEMPLATE;
    try {
      const templates = await db
        .select({ id: messageTemplate.id, body: messageTemplate.body })
        .from(messageTemplate)
        .where(
          eq(messageTemplate.id, "weekly_digest")
        );
      // Also fetch contract template separately
      const [contractTmpl] = await db
        .select({ body: messageTemplate.body })
        .from(messageTemplate)
        .where(eq(messageTemplate.id, "contract_alert"))
        .limit(1);
      const [weeklyTmpl] = await db
        .select({ body: messageTemplate.body })
        .from(messageTemplate)
        .where(eq(messageTemplate.id, "weekly_digest"))
        .limit(1);
      if (weeklyTmpl) weeklyBody = weeklyTmpl.body;
      if (contractTmpl) contractBody = contractTmpl.body;
    } catch {
      // Table may not exist yet — use defaults
    }

    const baseUrl = process.env.UAZAPI_BASE_URL;
    const groupJid = process.env.REMINDER_GROUP_JID ?? "";
    const adminGroupJid = process.env.ADMIN_GROUP_JID ?? "";

    const [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.isActive, true))
      .limit(1);

    let kanbanSent = 0;
    let contractAlertSent = false;

    if (baseUrl && wNum) {
      if (groupJid) {
        // ── Group mode: @mention each user ──
        for (const [, data] of byUser) {
          if (!data.phone) continue;

          const taskLines = data.tasks
            .map((t) => {
              const day = t.dueDate ? format(new Date(t.dueDate + "T12:00:00"), "EEE", { locale: ptBR }) : "";
              return `${PRIORITY_EMOJI[t.priority] ?? "•"} [${day}] ${t.title}`;
            })
            .join("\n");

          const message = applyTemplate(weeklyBody, {
            nome: data.name.split(" ")[0],
            semana: weekRange,
            qtd: String(data.tasks.length),
            tarefas: taskLines,
          });

          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${wNum.uazapiToken}`,
            },
            body: JSON.stringify({
              phone: groupJid,
              message: `@${data.phone}\n${message}`,
              mentionedJid: [`${data.phone}@s.whatsapp.net`],
            }),
          }).catch(() => null);

          kanbanSent++;
        }
      } else {
        // ── Individual mode ──
        for (const [, data] of byUser) {
          if (!data.phone) continue;

          const taskLines = data.tasks
            .map((t) => {
              const day = t.dueDate ? format(new Date(t.dueDate + "T12:00:00"), "EEE", { locale: ptBR }) : "";
              return `${PRIORITY_EMOJI[t.priority] ?? "•"} [${day}] ${t.title}`;
            })
            .join("\n");

          const message = applyTemplate(weeklyBody, {
            nome: data.name.split(" ")[0],
            semana: weekRange,
            qtd: String(data.tasks.length),
            tarefas: taskLines,
          });

          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${wNum.uazapiToken}`,
            },
            body: JSON.stringify({ phone: data.phone, message }),
          }).catch(() => null);

          kanbanSent++;
        }
      }

      // ── Contract alerts → admin group ──
      if (expiringContracts.length > 0 && adminGroupJid) {
        const contractLines = expiringContracts
          .map((c) => `• ${c.companyName} — vence ${c.endDate ? format(new Date(c.endDate + "T12:00:00"), "dd/MM/yyyy") : "?"}`)
          .join("\n");

        const message = applyTemplate(contractBody, {
          qtd: String(expiringContracts.length),
          contratos: contractLines,
        });

        await fetch(`${baseUrl}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "SessionKey": wNum.uazapiSession,
            "Token": wNum.uazapiToken,
          },
          body: JSON.stringify({ phone: adminGroupJid, message }),
        }).catch(() => null);

        contractAlertSent = true;
      }
    }

    return NextResponse.json({
      kanbanSent,
      contractAlerts: expiringContracts.length,
      contractAlertSent,
      mode: groupJid ? "group" : "individual",
    });
  } catch {
    console.error("[CRON] kanban-weekly failed:", { operation: "weekly_dispatch" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
