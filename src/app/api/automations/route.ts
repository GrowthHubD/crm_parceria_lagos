import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { automation, automationStep } from "@/lib/db/schema/automations";
import { eq, asc, desc } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  triggerType: z.enum(["stage_enter", "tag_added", "manual"]),
  triggerConfig: z.record(z.unknown()).optional().nullable(),
  steps: z
    .array(
      z.object({
        type: z.enum(["send_whatsapp", "wait", "send_email"]),
        config: z.record(z.unknown()),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canView = await checkPermission(ctx.userId, ctx.role as UserRole, "automations", "view", ctx);
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const automations = await db
      .select()
      .from(automation)
      .where(eq(automation.tenantId, ctx.tenantId))
      .orderBy(desc(automation.createdAt));

    // Buscar steps para cada automação
    const allSteps = await db
      .select()
      .from(automationStep)
      .orderBy(asc(automationStep.order));

    const result = automations.map((a) => ({
      ...a,
      steps: allSteps.filter((s) => s.automationId === a.id),
    }));

    return NextResponse.json({ automations: result });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canEdit = await checkPermission(ctx.userId, ctx.role as UserRole, "automations", "edit", ctx);
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;

    const [created] = await db
      .insert(automation)
      .values({
        tenantId: ctx.tenantId,
        name: d.name,
        description: d.description ?? null,
        triggerType: d.triggerType,
        triggerConfig: d.triggerConfig ?? null,
        isActive: true,
      })
      .returning();

    // Criar steps se fornecidos
    if (d.steps?.length) {
      for (let i = 0; i < d.steps.length; i++) {
        await db.insert(automationStep).values({
          automationId: created.id,
          order: i + 1,
          type: d.steps[i].type,
          config: d.steps[i].config,
        });
      }
    }

    return NextResponse.json({ automation: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
