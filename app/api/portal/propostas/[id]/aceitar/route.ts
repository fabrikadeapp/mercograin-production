/**
 * POST /api/portal/propostas/[id]/aceitar
 *
 * Cliente autenticado no portal aceita uma proposta. Dispara:
 *   1. Proposta.status = 'aceita'
 *   2. Snapshot do aceitante (nome, IP, UA, geo opcional) em observacoes
 *   3. Trigger pós-aceite: cria Contrato automaticamente (mesmo trigger
 *      usado em aprovação interna).
 *
 * Body: { aceitanteNome: string, geoLat?: number, geoLng?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { criarContratoAutoFromProposta } from '@/lib/bhgrain/contrato-auto-create'
import { sendEmail } from '@/lib/email/send'
import { propostaAceitaPortalTemplate } from '@/lib/email/templates/proposta-aceita-portal'

const schema = z.object({
  aceitanteNome: z.string().min(2, 'Nome muito curto').max(200),
  comentario: z.string().max(500).optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
})

const STATUS_ACEITAVEIS = new Set(['enviada', 'em_negociacao'])

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sess = await requirePortal()
    if (!sess) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const proposta = await db.proposta.findFirst({
      where: {
        id: params.id,
        clienteId: sess.clienteId,
        workspaceId: sess.workspaceId,
      },
      select: {
        id: true,
        numero: true,
        status: true,
        validadeEm: true,
        observacoes: true,
        valorTotal: true,
        cliente: { select: { nome: true } },
        vendedor: {
          select: {
            email: true,
            user: { select: { nome: true, email: true } },
          },
        },
        gerenteConta: {
          select: {
            email: true,
            user: { select: { nome: true, email: true } },
          },
        },
      },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (!STATUS_ACEITAVEIS.has(proposta.status)) {
      return NextResponse.json(
        { error: `Proposta não pode ser aceita (status atual: ${proposta.status})` },
        { status: 409 }
      )
    }

    if (proposta.validadeEm.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Proposta vencida' }, { status: 409 })
    }

    const ip =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const ua = request.headers.get('user-agent') ?? null

    const carimbo = [
      `[aceita pelo cliente em ${new Date().toISOString()}]`,
      `por: ${data.aceitanteNome}`,
      data.comentario ? `comentário: ${data.comentario}` : null,
      ip ? `ip: ${ip}` : null,
      ua ? `ua: ${ua.slice(0, 120)}` : null,
      data.geoLat != null && data.geoLng != null
        ? `geo: ${data.geoLat.toFixed(5)},${data.geoLng.toFixed(5)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const novasObs = [proposta.observacoes, carimbo].filter(Boolean).join('\n').trim()

    await db.proposta.update({
      where: { id: proposta.id },
      data: {
        status: 'aceita',
        observacoes: novasObs || null,
      },
    })

    await db.auditLog
      .create({
        data: {
          userId: sess.accessId,
          workspaceId: sess.workspaceId,
          acao: 'aceita_pelo_cliente_portal',
          entidade: 'proposta',
          entidadeId: proposta.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mudancas: {
            numero: proposta.numero,
            aceitanteNome: data.aceitanteNome,
            comentario: data.comentario ?? null,
            ip,
            ua: ua?.slice(0, 200) ?? null,
          } as any,
        },
      })
      .catch(() => undefined)

    // Trigger: cria Contrato automaticamente (best-effort)
    const contrato = await criarContratoAutoFromProposta({
      propostaId: proposta.id,
      workspaceId: sess.workspaceId,
      userId: sess.accessId,
    })

    // Notifica o vendedor + gerente da conta (best-effort, não bloqueia resposta)
    void notificarTime({
      proposta,
      contrato,
      aceitanteNome: data.aceitanteNome,
      comentario: data.comentario,
      aceitoEmISO: new Date().toISOString(),
      origin: request.headers.get('origin') ?? request.nextUrl.origin,
    })

    return NextResponse.json({
      ok: true,
      status: 'aceita',
      contrato,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Portal aceitar proposta error:', error)
    return NextResponse.json({ error: 'Erro ao aceitar proposta' }, { status: 500 })
  }
}

interface ProppForEmail {
  numero: string
  valorTotal: { toString: () => string } | number
  cliente: { nome: string } | null
  vendedor: {
    email: string | null
    user: { nome: string | null; email: string | null } | null
  } | null
  gerenteConta: {
    email: string | null
    user: { nome: string | null; email: string | null } | null
  } | null
}

async function notificarTime(args: {
  proposta: ProppForEmail
  contrato: { contratoId: string; numero: string; novo: boolean } | null
  aceitanteNome: string
  comentario?: string
  aceitoEmISO: string
  origin: string
}): Promise<void> {
  try {
    const destinos = new Map<string, string>() // email → nome
    for (const m of [args.proposta.vendedor, args.proposta.gerenteConta]) {
      if (!m) continue
      const email = m.user?.email ?? m.email
      const nome = m.user?.nome ?? email?.split('@')[0] ?? 'time comercial'
      if (email && !destinos.has(email)) destinos.set(email, nome)
    }
    if (destinos.size === 0) return

    const valorNum = Number(args.proposta.valorTotal)
    const valorFmt = valorNum.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    const linkInterno = args.contrato?.contratoId
      ? `${args.origin}/contratos/${args.contrato.contratoId}`
      : `${args.origin}/propostas`

    for (const [email, nome] of destinos) {
      const { propostaAceitaPortalTemplate } = await import(
        '@/lib/email/templates/proposta-aceita-portal'
      )
      const tmpl = propostaAceitaPortalTemplate({
        destinatarioNome: nome,
        clienteNome: args.proposta.cliente?.nome ?? 'Cliente',
        aceitanteNome: args.aceitanteNome,
        comentario: args.comentario,
        propostaNumero: args.proposta.numero,
        valorFormatado: valorFmt,
        contratoNumero: args.contrato?.numero ?? null,
        linkInterno,
        aceitoEm: args.aceitoEmISO,
      })
      await sendEmail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        tags: [
          { name: 'kind', value: 'proposta_aceita_portal' },
          { name: 'proposta_numero', value: args.proposta.numero },
        ],
      })
    }
  } catch (err) {
    console.warn('[notificarTime] best-effort falhou:', err)
  }
}
