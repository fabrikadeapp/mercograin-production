/**
 * Cron — marca propostas como 'expirada' quando validadeEm < now e ainda
 * estão em status aberto (rascunho, enviada, em_negociacao, etc).
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: diário às 09:00 UTC (06:00 BRT).
 *
 * Idempotente:
 *   - Roda updateMany filtrando por status em STATUS_ABERTOS + validadeEm < now.
 *   - Não revive propostas já marcadas como expirada/perdida/cancelada/aceita.
 *
 * Best-effort: erros não interrompem o lote inteiro; loga e continua.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { captureError, captureMessage } from '@/lib/observability/capture'
import { PROPOSTA_STATUS } from '@/lib/propostas/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Status considerados "abertos" — só estes são candidatos a virar expirada.
const STATUS_CANDIDATOS = [
  PROPOSTA_STATUS.RASCUNHO,
  PROPOSTA_STATUS.AGUARDANDO_AUTORIZACAO,
  PROPOSTA_STATUS.PENDENTE_APROVACAO,
  PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
  PROPOSTA_STATUS.ENVIADA,
  PROPOSTA_STATUS.EM_NEGOCIACAO,
]

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron propostas-expiradas: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let expiradas = 0
  let workspaces = 0

  try {
    // Busca propostas elegíveis em lote (sem update) pra audit log granular
    const elegiveis = await db.proposta.findMany({
      where: {
        status: { in: STATUS_CANDIDATOS },
        validadeEm: { lt: now },
      },
      select: {
        id: true,
        numero: true,
        status: true,
        workspaceId: true,
        validadeEm: true,
      },
      take: 1000, // safety cap; se passar, próximo cron pega o resto
    })

    if (elegiveis.length === 0) {
      return NextResponse.json({ ok: true, expiradas: 0, processadoEm: now.toISOString() })
    }

    const wsSeen = new Set<string>()
    for (const p of elegiveis) {
      wsSeen.add(p.workspaceId)
      try {
        await db.proposta.update({
          where: { id: p.id },
          data: { status: PROPOSTA_STATUS.EXPIRADA },
        })
        // Audit log best-effort
        await db.auditLog
          .create({
            data: {
              userId: 'system_cron',
              workspaceId: p.workspaceId,
              acao: 'proposta_expirada_auto',
              entidade: 'proposta',
              entidadeId: p.id,
              mudancas: {
                numero: p.numero,
                statusAnterior: p.status,
                statusNovo: PROPOSTA_STATUS.EXPIRADA,
                validadeEm: p.validadeEm.toISOString(),
                expiradaEm: now.toISOString(),
              },
            },
          })
          .catch(() => undefined)
        expiradas++
      } catch (err) {
        captureError(err as Error, {
          where: 'cron/propostas-expiradas',
          propostaId: p.id,
        })
      }
    }
    workspaces = wsSeen.size
  } catch (err) {
    captureError(err as Error, { where: 'cron/propostas-expiradas' })
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    expiradas,
    workspaces,
    processadoEm: now.toISOString(),
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
