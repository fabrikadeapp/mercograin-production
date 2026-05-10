/**
 * Cron — detecção de breaches de limite de risco.
 *
 * Schedule sugerido: a cada 30min em horário comercial seg-sex (11-22 UTC).
 * Auth: Bearer ${CRON_SECRET}
 * Idempotência: não cria novo breach para limite com breach aberto não resolvido.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularExposicaoAtual, detectarBreaches } from '@/lib/risco/limites'
import { riskBreachTemplate } from '@/lib/email/templates/risk-breach'
import { sendEmail } from '@/lib/email/send'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron risco-breaches: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const workspaces = await db.workspace.findMany({
    select: { id: true, name: true, owner: { select: { email: true, nome: true } } },
  })

  let totalDetectados = 0
  let totalCriados = 0
  let totalNotificados = 0
  const erros: string[] = []

  for (const ws of workspaces) {
    try {
      const expo = await calcularExposicaoAtual(ws.id)
      const candidatos = await detectarBreaches(ws.id, expo)
      totalDetectados += candidatos.length

      for (const c of candidatos) {
        // idempotência: já existe breach aberto para este limite?
        const aberto = await db.limiteBreach.findFirst({
          where: { limiteId: c.limiteId, resolvidoEm: null },
        })
        if (aberto) {
          // Atualiza severidade se piorou
          if (
            (aberto.severidade === 'aviso' && c.severidade !== 'aviso') ||
            (aberto.severidade === 'breach' && c.severidade === 'critico')
          ) {
            await db.limiteBreach.update({
              where: { id: aberto.id },
              data: {
                severidade: c.severidade,
                valorAtual: c.valorAtual,
                excedidoEm: c.excedidoEm,
              },
            })
          }
          continue
        }

        const created = await db.limiteBreach.create({
          data: {
            workspaceId: ws.id,
            limiteId: c.limiteId,
            valorAtual: c.valorAtual,
            valorMaximo: c.valorMaximo,
            excedidoEm: c.excedidoEm,
            severidade: c.severidade,
            triggerEntidade: 'exposicao',
            triggerSnapshot: {
              escopo: c.escopo,
              tipo: c.tipo,
              escopoFiltro: c.escopoFiltro,
            },
          },
        })
        totalCriados++

        // Notifica via email o owner do workspace
        if (ws.owner?.email) {
          const tpl = riskBreachTemplate({
            name: ws.owner.nome || ws.owner.email,
            escopo: `${c.escopo}${c.escopoFiltro ? ' ' + JSON.stringify(c.escopoFiltro) : ''}`,
            tipo: c.tipo,
            valorAtual: c.valorAtual,
            valorMaximo: c.valorMaximo,
            excedidoEm: c.excedidoEm,
            severidade: c.severidade,
            contexto: `Workspace ${ws.name}`,
          })
          const sent = await sendEmail({
            to: ws.owner.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            tags: [{ name: 'kind', value: 'risk-breach' }],
          })
          if (sent) {
            totalNotificados++
            await db.limiteBreach.update({
              where: { id: created.id },
              data: {
                notificadoPor: [{ canal: 'email', enviadoEm: new Date().toISOString() }] as any,
              },
            })
          }
        }
      }
    } catch (err: any) {
      erros.push(`ws=${ws.id}: ${err?.message ?? 'erro'}`)
      captureError(err, { workspaceId: ws.id, route: 'cron/risco-breaches' })
    }
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    workspaces: workspaces.length,
    detectados: totalDetectados,
    criados: totalCriados,
    notificados: totalNotificados,
    erros,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
