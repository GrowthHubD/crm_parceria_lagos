import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { sdrMetricSnapshot, sdrAgent } from "@/lib/db/schema/sdr";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  agentId: z.string().uuid(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  leadsProspected: z.number().int().min(0).default(0),
  newLeads: z.number().int().min(0).default(0),
  totalMessagesSent: z.number().int().min(0).default(0),
  messagesPerMeeting: z.coerce.number().min(0).default(0),
  responseRate: z.coerce.number().min(0).max(100).default(0),
  meetingsScheduled: z.number().int().min(0).default(0),
  meetingsShowRate: z.coerce.number().min(0).max(100).default(0),
  meetingsNoShow: z.number().int().min(0).default(0),
  meetingsRescheduled: z.number().int().min(0).default(0),
  meetingsCancelled: z.number().int().min(0).default(0),
  leadsRefused: z.number().int().min(0).default(0),
  leadsQualified: z.number().int().min(0).default(0),
  firstResponseTimeAvgMin: z.coerce.number().min(0).default(0),
  conversionRate: z.coerce.number().min(0).max(100).default(0),
  mrrGenerated: z.coerce.number().min(0).default(0),
  arrGenerated: z.coerce.number().min(0).default(0),
  revenueAttributed: z.coerce.number().min(0).default(0),
  dropoffStageData: z.record(z.number()).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "sdr", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];
    if (agentId) conditions.push(eq(sdrMetricSnapshot.agentId, agentId));
    if (from) conditions.push(gte(sdrMetricSnapshot.periodStart, from));
    if (to) conditions.push(lte(sdrMetricSnapshot.periodEnd, to));

    const metrics = await db
      .select({
        id: sdrMetricSnapshot.id,
        agentId: sdrMetricSnapshot.agentId,
        agentName: sdrAgent.name,
        periodStart: sdrMetricSnapshot.periodStart,
        periodEnd: sdrMetricSnapshot.periodEnd,
        leadsProspected: sdrMetricSnapshot.leadsProspected,
        newLeads: sdrMetricSnapshot.newLeads,
        totalMessagesSent: sdrMetricSnapshot.totalMessagesSent,
        messagesPerMeeting: sdrMetricSnapshot.messagesPerMeeting,
        responseRate: sdrMetricSnapshot.responseRate,
        meetingsScheduled: sdrMetricSnapshot.meetingsScheduled,
        meetingsShowRate: sdrMetricSnapshot.meetingsShowRate,
        meetingsNoShow: sdrMetricSnapshot.meetingsNoShow,
        meetingsRescheduled: sdrMetricSnapshot.meetingsRescheduled,
        meetingsCancelled: sdrMetricSnapshot.meetingsCancelled,
        leadsRefused: sdrMetricSnapshot.leadsRefused,
        leadsQualified: sdrMetricSnapshot.leadsQualified,
        firstResponseTimeAvgMin: sdrMetricSnapshot.firstResponseTimeAvgMin,
        conversionRate: sdrMetricSnapshot.conversionRate,
        mrrGenerated: sdrMetricSnapshot.mrrGenerated,
        arrGenerated: sdrMetricSnapshot.arrGenerated,
        revenueAttributed: sdrMetricSnapshot.revenueAttributed,
        dropoffStageData: sdrMetricSnapshot.dropoffStageData,
        createdAt: sdrMetricSnapshot.createdAt,
      })
      .from(sdrMetricSnapshot)
      .leftJoin(sdrAgent, eq(sdrMetricSnapshot.agentId, sdrAgent.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sdrMetricSnapshot.periodStart));

    return NextResponse.json({ metrics });
  } catch {
    console.error("[SDR] GET metrics failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "sdr", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const [metric] = await db
      .insert(sdrMetricSnapshot)
      .values({
        agentId: d.agentId,
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

    return NextResponse.json({ metric }, { status: 201 });
  } catch {
    console.error("[SDR] POST metric failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
