/**
 * POST /api/inbox/[conversationId]/criar-oferta — F2-01.
 *
 * Converte uma conversa (WhatsApp/inbox) em Oferta estruturada usando a extração
 * de IA já persistida na ConversationMessage (aiExtraction). Reusa os helpers de
 * Oferta. Permite override dos campos no body (revisão humana antes de salvar).
 *
 * Body (todos opcionais — sobrescrevem a extração da IA):
 *   { tipo, cultura, qtdSc, precoSc, precoMoeda, origem, destino, validadeHoras, observacao }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { gerarNumeroOferta, calcValidaAte } from '@/lib/ofertas/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const body = z.object({
  tipo: z.enum(['compra', 'venda']).optional(),
  cultura: z.string().optional(),
  qtdSc: z.number().positive().optional(),
  precoSc: z.number().positive().optional(),
  precoMoeda: z.enum(['BRL', 'USD']).optional(),
  origem: z.string().length(2).optional(),
  destino: z.string().length(2).optional(),
  validadeHoras: z.number().min(1).max(720).optional(),
  observacao: z.string().max(1000).optional(),
})

const UNIT_SC_POR_TON = 16.667 // ~ sacas (60kg) por tonelada

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const conv = await db.conversation.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true, channel: true, contactName: true, clienteId: true },
  })
  if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Última mensagem com extração de IA.
  const msgs = await db.conversationMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { aiExtraction: true },
  })
  const ext = (msgs.find((m) => m.aiExtraction)?.aiExtraction as Record<string, any> | undefined) ?? {}
  const override = body.parse(await req.json().catch(() => ({})))

  // Resolve cada campo: override > extração IA > default.
  const cultura = override.cultura ?? ext.commodity ?? null
  if (!cultura) {
    return NextResponse.json({ error: 'Sem cultura identificada — revise os dados da oferta.', extracao: ext }, { status: 422 })
  }

  // intencao 'oferta_venda' → venda; 'demanda_compra'/'compra' → compra; default venda.
  const intencao = String(ext.intencao ?? '')
  const tipo = override.tipo ?? (/compra|demanda/.test(intencao) ? 'compra' : 'venda')

  // Quantidade → sacas (a extração pode vir em t ou sc).
  let qtdSc = override.qtdSc
  if (qtdSc == null && ext.quantidade != null) {
    const q = Number(ext.quantidade)
    qtdSc = ext.unidade === 't' ? Math.round(q * UNIT_SC_POR_TON) : q
  }
  qtdSc = qtdSc ?? 0

  const precoSc = override.precoSc ?? Number(ext.preco ?? 0)
  const validadeHoras = override.validadeHoras ?? 72

  const oferta = await db.oferta.create({
    data: {
      workspaceId: scope.workspaceId,
      numero: gerarNumeroOferta(),
      tipo,
      cultura: String(cultura).toLowerCase(),
      qtdSc,
      precoSc,
      precoMoeda: override.precoMoeda ?? 'BRL',
      origem: override.origem ?? null,
      destino: override.destino ?? (ext.localEntrega ? String(ext.localEntrega).slice(0, 2).toUpperCase() : null),
      validadeHoras,
      validaAte: calcValidaAte(validadeHoras),
      status: 'aberta',
      proprietarioId: scope.userId,
      observacao: override.observacao ?? `Capturada de ${conv.channel} · ${conv.contactName ?? ''}`,
    },
    select: { id: true, numero: true },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'oferta_capturada_whatsapp',
    entidade: 'oferta',
    entidadeId: oferta.id,
    mudancas: { numero: oferta.numero, conversationId: conv.id, fonte: conv.channel },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, oferta })
}
