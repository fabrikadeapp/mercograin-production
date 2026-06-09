/**
 * GET /api/mesa/fila-acao
 *
 * Fila de ação unificada da Mesa de Operações. Agrega 3 origens numa única
 * lista ordenada por urgência (SLA), cada item com selo de origem:
 *   - pedido   → SolicitacaoCotacao pendentes (oferta inbound do produtor)
 *   - rascunho → Proposta status='rascunho' (montada, não enviada)
 *   - travada  → Proposta status='cancelada' (falha/exceção — proxy até existir
 *                campo de motivo de erro dedicado)
 *
 * Retorno: { ok, items: FilaItem[], counts: { pedido, rascunho, travada } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Origem = 'pedido' | 'rascunho' | 'travada'

interface FilaItem {
  id: string
  origem: Origem
  cliente: string
  resumo: string
  /** Horas paradas (para ordenação e exibição de SLA). */
  horas: number
  createdAt: string
  href: string
  acao: string
}

function horasDesde(d: Date): number {
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 3_600_000))
}

function commodityLabel(grao: string): string {
  return grao ? grao.charAt(0).toUpperCase() + grao.slice(1) : ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [solicitacoes, rascunhos, travadas] = await Promise.all([
    db.solicitacaoCotacao.findMany({
      where: scope.whereOwn({ status: 'pendente' }),
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { cliente: { select: { nome: true } } },
    }),
    db.proposta.findMany({
      where: scope.whereOwn({ status: { in: ['rascunho', 'rascunho_ia'] } }),
      orderBy: { criadaEm: 'asc' },
      take: 50,
      select: { id: true, numero: true, status: true, tipo: true, criadaEm: true, cliente: { select: { nome: true } } },
    }),
    db.proposta.findMany({
      where: scope.whereOwn({ status: 'cancelada' }),
      orderBy: { atualizadaEm: 'asc' },
      take: 50,
      include: { cliente: { select: { nome: true } } },
    }),
  ])

  const items: FilaItem[] = []

  for (const s of solicitacoes) {
    const qtd = Number(s.quantidade)
    const preco = s.precoAlvo != null ? ` · pede R$ ${Number(s.precoAlvo).toFixed(2)}/${s.unidade}` : ' · a mercado'
    items.push({
      id: s.id,
      origem: 'pedido',
      cliente: s.cliente?.nome ?? 'Cliente',
      resumo: `Oferta de ${s.tipo} · ${commodityLabel(s.grao)} · ${qtd.toLocaleString('pt-BR')} ${s.unidade}${preco}`,
      horas: horasDesde(s.createdAt),
      createdAt: s.createdAt.toISOString(),
      href: `/solicitacoes?id=${s.id}`,
      acao: 'Responder',
    })
  }

  for (const p of rascunhos) {
    const porIA = p.status === 'rascunho_ia'
    const op = p.tipo === 'compra' ? 'compra' : 'venda'
    items.push({
      id: p.id,
      origem: 'rascunho',
      cliente: p.cliente?.nome ?? 'Cliente',
      resumo: porIA
        ? `Proposta de ${op} ${p.numero} gerada por IA · revisar e enviar`
        : `Proposta ${p.numero} montada · aguardando seu envio`,
      horas: horasDesde(p.criadaEm),
      createdAt: p.criadaEm.toISOString(),
      href: `/propostas/${p.id}`,
      acao: 'Revisar e enviar',
    })
  }

  for (const p of travadas) {
    items.push({
      id: p.id,
      origem: 'travada',
      cliente: p.cliente?.nome ?? 'Cliente',
      resumo: `Proposta ${p.numero} não processada · requer intervenção`,
      horas: horasDesde(p.atualizadaEm),
      createdAt: p.atualizadaEm.toISOString(),
      href: `/propostas/${p.id}`,
      acao: 'Resolver',
    })
  }

  // Ordena por urgência: travadas pesam mais, depois por horas paradas (desc).
  const peso: Record<Origem, number> = { travada: 2, pedido: 1, rascunho: 1 }
  items.sort((a, b) => peso[b.origem] - peso[a.origem] || b.horas - a.horas)

  return NextResponse.json({
    ok: true,
    items,
    counts: {
      pedido: solicitacoes.length,
      rascunho: rascunhos.length,
      travada: travadas.length,
    },
  })
}
