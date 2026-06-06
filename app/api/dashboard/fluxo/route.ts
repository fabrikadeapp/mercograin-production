/**
 * GET /api/dashboard/fluxo
 * Retorna os 4 cards de fluxo da mesa:
 *  - solicitacoes_nao_processadas (pendente, sem proposta)
 *  - propostas_em_revisao (status='rascunho', origem='portal_solicitacao_auto')
 *  - propostas_no_cliente (status='enviada')
 *  - contratos_aguardando_envio (statusAssinatura='pendente')
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const own: any = scope.whereOwn()

  const [naoProcessadas, emRevisao, noCliente, contratosAguardando] = await Promise.all([
    // 1. Solicitações pendentes que não foram convertidas
    db.solicitacaoCotacao.findMany({
      where: { ...own, status: 'pendente' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { cliente: { select: { nome: true } } },
    }),

    // 2. Propostas em rascunho geradas automaticamente (aguardando revisão)
    db.proposta.findMany({
      where: {
        ...own,
        status: 'rascunho',
      },
      orderBy: { criadaEm: 'desc' },
      take: 20,
      include: { cliente: { select: { nome: true } } },
    }),

    // 3. Propostas enviadas (aguardando cliente aceitar)
    db.proposta.findMany({
      where: { ...own, status: 'enviada' },
      orderBy: { enviadaEm: 'desc' },
      take: 20,
      include: { cliente: { select: { nome: true } } },
    }),

    // 4. Contratos criados mas não enviados ainda para assinatura
    db.contrato.findMany({
      where: { ...own, statusAssinatura: 'pendente' },
      orderBy: { criadoEm: 'desc' },
      take: 20,
      include: {
        cliente: { select: { nome: true } },
        proposta: { select: { numero: true, valorTotal: true } },
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    cards: {
      naoProcessadas: {
        total: naoProcessadas.length,
        items: naoProcessadas.map((s) => ({
          id: s.id,
          cliente: s.cliente.nome,
          grao: s.grao,
          quantidade: Number(s.quantidade),
          unidade: s.unidade,
          tipo: s.tipo,
          precoAlvo: s.precoAlvo ? Number(s.precoAlvo) : null,
          observacao: s.observacao,
          createdAt: s.createdAt,
        })),
      },
      emRevisao: {
        total: emRevisao.length,
        items: emRevisao.map((p) => ({
          id: p.id,
          numero: p.numero,
          cliente: p.cliente.nome,
          valor: Number(p.valorTotal),
          tipo: p.tipo,
          criadaEm: p.criadaEm,
          origem: p.origem,
        })),
      },
      noCliente: {
        total: noCliente.length,
        items: noCliente.map((p) => ({
          id: p.id,
          numero: p.numero,
          cliente: p.cliente.nome,
          valor: Number(p.valorTotal),
          enviadaEm: p.enviadaEm,
        })),
      },
      contratosAguardando: {
        total: contratosAguardando.length,
        items: contratosAguardando.map((c) => ({
          id: c.id,
          numero: c.numero,
          cliente: c.cliente.nome,
          propostaNumero: c.proposta?.numero ?? null,
          valor: c.proposta?.valorTotal ? Number(c.proposta.valorTotal) : null,
          criadoEm: c.criadoEm,
        })),
      },
    },
  })
}
