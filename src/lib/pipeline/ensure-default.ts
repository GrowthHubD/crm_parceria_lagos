/**
 * ensureDefaultPipeline — garante que um tenant SEMPRE tenha um funil default
 * com as 5 etapas padrão. Idempotente e seguro pra chamar em qualquer caminho:
 *   - onboarding (provisioning.ts)
 *   - webhook de mensagem recebida (antes de criar lead) — assim TODA conversa
 *     vira lead mesmo em tenant que nunca passou pelo onboarding
 *   - lazy no carregamento do pipeline (page / API)
 *
 * Antes, o webhook fazia `if (firstStage)` e PULAVA silenciosamente a criação
 * do lead quando o tenant não tinha etapa — deixando o pipeline vazio apesar de
 * conversas ativas. Centralizar o bootstrap aqui elimina essa classe de bug.
 */

import { db } from "../db";
import { pipeline, pipelineStage } from "../db/schema/pipeline";
import { eq, and, asc } from "drizzle-orm";

/** Etapas padrão de um funil novo. Fonte única (provisioning importa daqui). */
export const DEFAULT_STAGES = [
  { name: "Novo", order: 0, color: "#6B7280", isWon: false },
  { name: "Em contato", order: 1, color: "#3B82F6", isWon: false },
  { name: "Negociação", order: 2, color: "#F59E0B", isWon: false },
  { name: "Ganho", order: 3, color: "#10B981", isWon: true },
  { name: "Perdido", order: 4, color: "#EF4444", isWon: false },
] as const;

export interface DefaultPipelineResult {
  pipelineId: string;
  /** Id da etapa de menor `order` (a "primeira" — onde leads novos entram). */
  firstStageId: string;
}

/**
 * Retorna o funil default do tenant (criando-o se não existir) e o id da
 * primeira etapa. Idempotente: chamadas repetidas não duplicam dados.
 */
export async function ensureDefaultPipeline(
  tenantId: string
): Promise<DefaultPipelineResult> {
  // 1. Funil default → senão o mais antigo → senão cria.
  let pl =
    (
      await db
        .select({ id: pipeline.id })
        .from(pipeline)
        .where(and(eq(pipeline.tenantId, tenantId), eq(pipeline.isDefault, true)))
        .limit(1)
    )[0] ??
    (
      await db
        .select({ id: pipeline.id })
        .from(pipeline)
        .where(eq(pipeline.tenantId, tenantId))
        .orderBy(asc(pipeline.createdAt))
        .limit(1)
    )[0];

  if (!pl) {
    [pl] = await db
      .insert(pipeline)
      .values({
        tenantId,
        name: "Funil principal",
        description: "Funil padrão",
        isDefault: true,
      })
      .returning({ id: pipeline.id });
  }

  // 2. Garante as etapas do funil.
  const stages = await db
    .select({ id: pipelineStage.id, order: pipelineStage.order })
    .from(pipelineStage)
    .where(and(eq(pipelineStage.tenantId, tenantId), eq(pipelineStage.pipelineId, pl.id)))
    .orderBy(asc(pipelineStage.order));

  if (stages.length > 0) {
    return { pipelineId: pl.id, firstStageId: stages[0].id };
  }

  const inserted = await db
    .insert(pipelineStage)
    .values(
      DEFAULT_STAGES.map((s) => ({
        tenantId,
        pipelineId: pl.id,
        name: s.name,
        order: s.order,
        color: s.color,
        isWon: s.isWon,
      }))
    )
    .returning({ id: pipelineStage.id, order: pipelineStage.order });

  inserted.sort((a, b) => a.order - b.order);
  return { pipelineId: pl.id, firstStageId: inserted[0].id };
}
