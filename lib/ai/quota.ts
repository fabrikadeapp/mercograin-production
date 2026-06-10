/**
 * Enforcement da cota mensal de mensagens de IA (Laura).
 *
 * `Plan.aiMonthlyMessages` define o limite mensal de mensagens consumidas.
 *   - 0  → ILIMITADO (não bloqueia). É o default dos planos pro/enterprise hoje.
 *   - >0 → limite real; a IA para de responder quando `used >= limit`.
 *
 * MÉTRICA DE CONTAGEM ("mensagem consumida"):
 *   Contamos cada LauraMessage entrante (direcao='in') do workspace, no mês
 *   corrente, que efetivamente disparou o LLM — i.e. com `llmProvider` não nulo.
 *
 *   Por quê esta métrica:
 *     - Em lib/laura/process-message.ts, TODA mensagem é gravada com direcao='in'
 *       (não há registro 'out' separado para a resposta da IA). A telemetria do
 *       LLM (llmProvider/tokens/custo) é anexada NESSA mesma mensagem 'in' quando
 *       o LLM é chamado.
 *     - Logo, "mensagem do usuário que disparou a IA" e "resposta da IA" são o
 *       mesmo registro. Contar mensagens com llmProvider != null mede exatamente
 *       quantas chamadas reais de LLM o workspace consumiu — que é o custo que a
 *       cota protege. Mensagens gravadas sem LLM (feature off, fallback heurístico
 *       sem provider) NÃO consomem cota.
 */

import { db } from '@/lib/db'

export interface AiQuotaStatus {
  /** false = cota estourada (IA deve parar de responder) */
  ok: boolean
  /** mensagens de IA consumidas no mês corrente */
  used: number
  /** limite do plano; 0 = ilimitado */
  limit: number
}

/** Início do mês corrente (dia 1, 00:00 horário local do servidor). */
function startOfCurrentMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Conta as mensagens de IA consumidas pelo workspace no mês corrente.
 * Métrica: LauraMessage(direcao='in', llmProvider != null) via conversation.workspaceId.
 */
export async function countAiMessagesThisMonth(
  workspaceId: string,
  now = new Date(),
): Promise<number> {
  return db.lauraMessage.count({
    where: {
      direcao: 'in',
      llmProvider: { not: null },
      createdAt: { gte: startOfCurrentMonth(now) },
      conversation: { workspaceId },
    },
  })
}

/**
 * Verifica se o workspace ainda pode consumir mensagens de IA neste mês.
 *
 *   - Carrega o plano via subscription.plan (slug) → Plan.aiMonthlyMessages.
 *   - limit === 0 → ilimitado → { ok: true }.
 *   - Caso contrário, conta o uso do mês e retorna ok = used < limit.
 */
export async function checkAiQuota(
  workspaceId: string,
): Promise<AiQuotaStatus> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { subscription: { select: { plan: true } } },
  })

  const planSlug = ws?.subscription?.plan ?? null
  const plan = planSlug
    ? await db.plan.findUnique({
        where: { slug: planSlug },
        select: { aiMonthlyMessages: true },
      })
    : null

  const limit = plan?.aiMonthlyMessages ?? 0

  // 0 = ilimitado → nunca bloqueia (não precisa contar).
  if (limit === 0) {
    return { ok: true, used: 0, limit: 0 }
  }

  const used = await countAiMessagesThisMonth(workspaceId)
  return { ok: used < limit, used, limit }
}
