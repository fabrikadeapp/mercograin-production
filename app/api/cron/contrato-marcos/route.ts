/**
 * Cron diário — marcos de vencimento de contratos.
 *
 * Trigger: GitHub Actions, schedule 09:00 UTC (06:00 BRT) diário.
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 *
 * Lógica:
 *  - Busca Contratos com statusAssinatura='assinado' E dataFim != null
 *  - Calcula dias restantes até dataFim (em UTC)
 *  - Marcos: 30d (>=29 e <=31), 15d, 7d, 1d, vencido (dataFim < hoje, último envio).
 *  - Idempotência: ContratoNotificacao.{contratoId, marco} unique — 1 envio/marco.
 *  - Envia email pro cliente (se tiver email) e pro owner do workspace.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import {
  contractMilestoneTemplate,
  type ContractMilestone,
} from '@/lib/email/templates/contract-milestone'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.profitsync.ia.br'

function diasRestantes(now: Date, dataFim: Date): number {
  const ms = dataFim.getTime() - now.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function classifyMarco(dias: number): ContractMilestone | null {
  if (dias < 0) return 'vencido'
  if (dias === 1) return '1d'
  if (dias === 7) return '7d'
  if (dias === 15) return '15d'
  if (dias === 30) return '30d'
  return null
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron contrato-marcos: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const now = new Date()

  const contratos = await db.contrato.findMany({
    where: {
      statusAssinatura: 'assinado',
      dataFim: { not: null },
    },
    include: {
      cliente: { select: { nome: true, email: true } },
      workspace: {
        select: {
          id: true,
          owner: { select: { email: true, nome: true } },
        },
      },
    },
  })

  let avaliados = 0
  let enviados = 0
  let pulados = 0
  const erros: string[] = []

  for (const c of contratos) {
    avaliados++
    if (!c.dataFim) continue
    const dias = diasRestantes(now, c.dataFim)
    const marco = classifyMarco(dias)
    if (!marco) {
      pulados++
      continue
    }

    try {
      // Idempotência: tenta criar o registro; se já existe (P2002), pula.
      try {
        await db.contratoNotificacao.create({
          data: {
            workspaceId: c.workspaceId,
            contratoId: c.id,
            marco,
          },
        })
      } catch (e: any) {
        // unique violation → marco já enviado
        if (e?.code === 'P2002') {
          pulados++
          continue
        }
        throw e
      }

      const tpl = contractMilestoneTemplate({
        contractNumber: c.numero,
        clienteNome: c.cliente?.nome ?? '—',
        dataFim: c.dataFim,
        marco,
        contractUrl: `${APP_URL}/contratos/${c.id}`,
      })

      const recipients: string[] = []
      if (c.workspace?.owner?.email) recipients.push(c.workspace.owner.email)
      if (c.cliente?.email) recipients.push(c.cliente.email)

      if (recipients.length > 0) {
        await sendEmail({
          to: recipients,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          tags: [
            { name: 'kind', value: 'contract-milestone' },
            { name: 'marco', value: marco },
          ],
        })
        enviados++
      } else {
        pulados++
      }
    } catch (err: any) {
      erros.push(`${c.id}: ${err?.message ?? 'erro'}`)
      captureError(err, { contratoId: c.id, route: 'cron/contrato-marcos' })
    }
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    avaliados,
    enviados,
    pulados,
    erros,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
