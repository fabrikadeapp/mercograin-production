/**
 * POST /api/propostas/bulk
 *
 * Ações em massa no book de propostas. Suporta:
 *   - 'marcar-perdida': mesmo motivo+obs para várias propostas
 *   - 'enviar': dispara envio para várias (cada uma vai pela rota /enviar)
 *
 * Body:
 *   {
 *     acao: 'marcar-perdida' | 'enviar',
 *     ids: string[],            // até 100
 *     // Quando acao = 'marcar-perdida':
 *     lossReason?: string,
 *     observacoes?: string,
 *   }
 *
 * Resposta: { sucessos: [ids], falhas: [{id, motivo}] }
 *
 * Best-effort: erros individuais não interrompem o lote.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { revalidateTag } from 'next/cache'
import { PROPOSTA_STATUS, podeMarcarPerdida } from '@/lib/propostas/status'

const LOSS_REASONS = [
  'preco',
  'concorrencia',
  'prazo',
  'qualidade',
  'logistica',
  'sem_resposta',
  'outro',
] as const

const schema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('marcar-perdida'),
    ids: z.array(z.string()).min(1).max(100),
    lossReason: z.enum(LOSS_REASONS),
    observacoes: z.string().max(500).optional(),
  }),
  z.object({
    acao: z.literal('enviar'),
    ids: z.array(z.string()).min(1).max(100),
  }),
])

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const sucessos: string[] = []
    const falhas: { id: string; motivo: string }[] = []

    // Carrega todas as propostas alvo numa só query
    const propostas = await db.proposta.findMany({
      where: { id: { in: data.ids }, ...scope.whereOwn() },
      select: { id: true, numero: true, status: true, observacoes: true },
    })

    const propostasMap = new Map(propostas.map((p) => [p.id, p]))

    // Detecta ids inválidos
    for (const id of data.ids) {
      if (!propostasMap.has(id)) {
        falhas.push({ id, motivo: 'não encontrada ou fora do workspace' })
      }
    }

    if (data.acao === 'marcar-perdida') {
      for (const p of propostas) {
        if (!podeMarcarPerdida(p.status)) {
          falhas.push({ id: p.id, motivo: `status '${p.status}' não permite marcar perdida` })
          continue
        }
        try {
          const novasObs = [
            p.observacoes,
            data.observacoes ? `[bulk perdida — motivo: ${data.lossReason}] ${data.observacoes}` : null,
          ]
            .filter(Boolean)
            .join('\n')
            .trim()

          await db.proposta.update({
            where: { id: p.id },
            data: {
              status: PROPOSTA_STATUS.PERDIDA,
              lossReason: data.lossReason,
              observacoes: novasObs || null,
            },
          })
          await logAudit({
            userId: scope.userId,
            workspaceId: scope.workspaceId,
            acao: 'bulk_marcar_perdida',
            entidade: 'proposta',
            entidadeId: p.id,
            mudancas: {
              numero: p.numero,
              statusAnterior: p.status,
              statusNovo: PROPOSTA_STATUS.PERDIDA,
              lossReason: data.lossReason,
            },
          }).catch(() => undefined)
          sucessos.push(p.id)
        } catch (err) {
          falhas.push({
            id: p.id,
            motivo: err instanceof Error ? err.message : 'erro desconhecido',
          })
        }
      }
    } else if (data.acao === 'enviar') {
      // "Enviar" em bulk = atualiza status para 'enviada' direto (sem enforcement
      // de CommercialRule individual — operador assume responsabilidade).
      // Para forçar enforcement, melhor usar /api/bhgrain/propostas/[id]/enviar
      // individual; este endpoint é para casos onde já está validado.
      const STATUS_ENVIAVEIS = new Set<string>([
        PROPOSTA_STATUS.RASCUNHO,
        PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
      ])
      for (const p of propostas) {
        if (!STATUS_ENVIAVEIS.has(p.status)) {
          falhas.push({ id: p.id, motivo: `status '${p.status}' não pode ser enviado` })
          continue
        }
        try {
          await db.proposta.update({
            where: { id: p.id },
            data: {
              status: PROPOSTA_STATUS.ENVIADA,
              enviadaEm: new Date(),
            },
          })
          await logAudit({
            userId: scope.userId,
            workspaceId: scope.workspaceId,
            acao: 'bulk_enviar',
            entidade: 'proposta',
            entidadeId: p.id,
            mudancas: { numero: p.numero, statusAnterior: p.status },
          }).catch(() => undefined)
          sucessos.push(p.id)
        } catch (err) {
          falhas.push({
            id: p.id,
            motivo: err instanceof Error ? err.message : 'erro desconhecido',
          })
        }
      }
    }

    revalidateTag('propostas')
    return NextResponse.json({
      acao: data.acao,
      total: data.ids.length,
      sucessos,
      falhas,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Bulk propostas error:', error)
    return NextResponse.json({ error: 'Erro no processamento em lote' }, { status: 500 })
  }
}
