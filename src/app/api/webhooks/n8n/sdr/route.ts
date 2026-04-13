/**
 * Webhook endpoint for n8n to push SDR agent metrics.
 *
 * Authentication: header  X-N8N-Secret: <N8N_WEBHOOK_SECRET env var>
 *
 * Payload (all numeric fields are optional — missing fields default to 0):
 * {
 *   "agentName": "Agente Apollo",        // required — looks up or creates the agent
 *   "periodStart": "2026-04-07",          // required — YYYY-MM-DD
 *   "periodEnd":   "2026-04-13",          // required — YYYY-MM-DD
 *   "leadsProspected": 120,
 *   "newLeads": 35,
 *   "totalMessagesSent": 480,
 *   "messagesPerMeeting": 12.5,
 *   "responseRate": 32.5,
 *   "meetingsScheduled": 8,
 *   "meetingsShowRate": 75.0,
 *   "meetingsNoShow": 2,
 *   "meetingsRescheduled": 1,
 *   "meetingsCancelled": 0,
 *   "leadsRefused": 15,
 *   "leadsQualified": 20,
 *   "firstResponseTimeAvgMin": 4.2,
 *   "conversionRate": 6.7,
 *   "mrrGenerated": 5000.00,
 *   "arrGenerated": 60000.00,
 *   "revenueAttributed": 5000.00,
 *   "dropoffStageData": { "sem_atendimento": 40, "em_atendimento": 25 }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sdrAgent, sdrMetricSnapshot } from "@/lib/db/schema/sdr";
import { eq } from "drizzle-orm";

const payloadSchema = z.object({
  agentName: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  leadsProspected: z.coerce.number().int().min(0).default(0),
  newLeads: z.coerce.number().int().min(0).default(0),
  totalMessagesSent: z.coerce.number().int().min(0).default(0),
  messagesPerMeeting: z.coerce.number().min(0).default(0),
  responseRate: z.coerce.number().min(0).max(100).default(0),
  meetingsScheduled: z.coerce.number().int().min(0).default(0),
  meetingsShowRate: z.coerce.number().min(0).max(100).default(0),
  meetingsNoShow: z.coerce.number().int().min(0).default(0),
  meetingsRescheduled: z.coerce.number().int().min(0).default(0),
  meetingsCancelled: z.coerce.number().int().min(0).default(0),
  leadsRefused: z.coerce.number().int().min(0).default(0),
  leadsQualified: z.coerce.number().int().min(0).default(0),
  firstResponseTimeAvgMin: z.coerce.number().min(0).default(0),
  conversionRate: z.coerce.number().min(0).max(100).default(0),
  mrrGenerated: z.coerce.number().min(0).default(0),
  arrGenerated: z.coerce.number().min(0).default(0),
  revenueAttributed: z.coerce.number().min(0).default(0),
  dropoffStageData: z.record(z.number()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate via secret header
    const secret = request.headers.get("x-n8n-secret");
    const expected = process.env.N8N_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;

    // Look up agent by name — create if not found
    let [agent] = await db
      .select()
      .from(sdrAgent)
      .where(eq(sdrAgent.name, d.agentName))
      .limit(1);

    if (!agent) {
      [agent] = await db
        .insert(sdrAgent)
        .values({ name: d.agentName, isActive: true })
        .returning();
    }

    const [metric] = await db
      .insert(sdrMetricSnapshot)
      .values({
        agentId: agent.id,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        leadsProspected: d.leadsProspected,
        newLeads: d.newLeads,
        totalMessagesSent: d.totalMessagesSent,
        messagesPerMeeting: String(d.messagesPerMeeting),
        responseRate: String(d.responseRate),
        meetingsScheduled: d.meetingsScheduled,
        meetingsShowRate: String(d.meetingsShowRate),
        meetingsNoShow: d.meetingsNoShow,
        meetingsRescheduled: d.meetingsRescheduled,
        meetingsCancelled: d.meetingsCancelled,
        leadsRefused: d.leadsRefused,
        leadsQualified: d.leadsQualified,
        firstResponseTimeAvgMin: String(d.firstResponseTimeAvgMin),
        conversionRate: String(d.conversionRate),
        mrrGenerated: String(d.mrrGenerated),
        arrGenerated: String(d.arrGenerated),
        revenueAttributed: String(d.revenueAttributed),
        dropoffStageData: d.dropoffStageData ?? null,
      })
      .returning();

    return NextResponse.json({ ok: true, metricId: metric.id, agentId: agent.id });
  } catch (error) {
    console.error("[WEBHOOK] n8n SDR push failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
