/**
 * TEMPORÁRIO — smoke E2E do fluxo completo refatorado.
 *
 * Passos:
 *  1. Produtor cria solicitação (500 t soja) → sistema tenta auto-converter
 *  2. Verifica se virou proposta 'rascunho' (em revisão) ou ficou 'pendente'
 *  3. Marca proposta como 'aceita' (simula corretora revisou + cliente aceitou)
 *  4. Cria contrato a partir da proposta (vai para "aguardando envio")
 *  5. Lista os 4 cards de fluxo e mostra totais
 *  6. Limpa tudo no fim
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoConverterSolicitacao } from '@/lib/solicitacoes/auto-converter'
import { nextNumber } from '@/lib/numbering/next-number'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

interface Passo {
  passo: string
  ok: boolean
  detalhe?: unknown
  erro?: string
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const passos: Passo[] = []
  const lixoIds: { proposta?: string; contrato?: string; solicitacao?: string } = {}

  try {
    const ws = await db.workspace.findUnique({
      where: { slug: 'mercograin' },
      select: { id: true },
    })
    if (!ws) return NextResponse.json({ error: 'no_workspace' }, { status: 404 })

    const cliente = await db.cliente.findFirst({
      where: { workspaceId: ws.id, nome: { contains: 'rei do gado', mode: 'insensitive' } },
      select: { id: true, nome: true },
    })
    if (!cliente) return NextResponse.json({ error: 'no_cliente' }, { status: 404 })

    const access = await db.produtorAccess.findFirst({
      where: { clienteId: cliente.id },
      select: { id: true },
    })

    // 1. Cria solicitação como se fosse o produtor
    const sol = await db.solicitacaoCotacao.create({
      data: {
        workspaceId: ws.id,
        clienteId: cliente.id,
        produtorAccessId: access?.id ?? null,
        tipo: 'venda',
        grao: 'soja',
        quantidade: 500,
        unidade: 't',
        precoAlvo: 1500,
        prazoEntregaDias: 45,
        localEntrega: 'Porto de Rio Grande',
        observacao: 'Smoke E2E — auto-converter teste',
        status: 'pendente',
      },
    })
    lixoIds.solicitacao = sol.id
    passos.push({ passo: '1-solicitacao-criada', ok: true, detalhe: { id: sol.id } })

    // 2. Auto-converter
    const auto = await autoConverterSolicitacao(sol)
    if (auto.propostaId) lixoIds.proposta = auto.propostaId
    passos.push({
      passo: '2-auto-converter',
      ok: auto.ok,
      detalhe: {
        motivo: auto.motivo,
        propostaNumero: auto.propostaNumero,
        preco: auto.preco?.toFixed(2),
        valor: auto.valorTotal?.toFixed(2),
      },
    })

    let propostaId = auto.propostaId

    // 3. Se não auto-converteu, cria proposta manual (simulando staff)
    if (!propostaId) {
      const numero = await nextNumber(ws.id, 'proposta')
      const subtotal = 500 * 1500
      const p = await db.proposta.create({
        data: {
          numero,
          clienteId: cliente.id,
          workspaceId: ws.id,
          tipo: 'venda',
          graos: [{ grao: 'soja', quantidade: 500, unidade: 't', preco: 1500, subtotal }],
          valorTotal: String(subtotal),
          status: 'rascunho',
          validadeEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          validadeCotacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          canalAutorizacao: 'web',
          origem: 'smoke_fallback',
        },
      })
      propostaId = p.id
      lixoIds.proposta = p.id
      await db.solicitacaoCotacao.update({
        where: { id: sol.id },
        data: { status: 'em_analise', propostaId: p.id },
      })
      passos.push({ passo: '3-fallback-criar-proposta', ok: true, detalhe: { id: p.id } })
    } else {
      passos.push({ passo: '3-fallback-nao-necessario', ok: true })
    }

    // 4. Marca proposta como 'enviada' (simula staff revisou + enviou)
    await db.proposta.update({
      where: { id: propostaId },
      data: { status: 'enviada', enviadaEm: new Date() },
    })
    passos.push({ passo: '4-proposta-enviada', ok: true })

    // 5. Marca proposta como 'aceita' (simula cliente aceitou)
    await db.proposta.update({
      where: { id: propostaId },
      data: { status: 'aceita' },
    })
    passos.push({ passo: '5-proposta-aceita', ok: true })

    // 6. Cria contrato (statusAssinatura='pendente' = aguardando envio)
    const numeroCT = await nextNumber(ws.id, 'contrato')
    const contrato = await db.contrato.create({
      data: {
        numero: numeroCT,
        proposIdFk: propostaId!,
        clienteId: cliente.id,
        workspaceId: ws.id,
        dataInicio: new Date(),
        statusAssinatura: 'pendente',
        modalidade: 'fixo',
      },
    })
    lixoIds.contrato = contrato.id
    passos.push({ passo: '6-contrato-criado', ok: true, detalhe: { numero: contrato.numero } })

    // 7. Snapshot dos 4 cards
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const own: any = { workspaceId: ws.id }
    const [naoProc, emRev, noCli, ctAg] = await Promise.all([
      db.solicitacaoCotacao.count({ where: { ...own, status: 'pendente' } }),
      db.proposta.count({ where: { ...own, status: 'rascunho' } }),
      db.proposta.count({ where: { ...own, status: 'enviada' } }),
      db.contrato.count({ where: { ...own, statusAssinatura: 'pendente' } }),
    ])
    passos.push({
      passo: '7-snapshot-4-cards',
      ok: true,
      detalhe: {
        naoProcessadas: naoProc,
        emRevisao: emRev,
        noCliente: noCli,
        contratosAguardando: ctAg,
      },
    })

    // 8. Limpeza
    if (lixoIds.contrato) await db.contrato.delete({ where: { id: lixoIds.contrato } }).catch(() => undefined)
    if (lixoIds.proposta) await db.proposta.delete({ where: { id: lixoIds.proposta } }).catch(() => undefined)
    if (lixoIds.solicitacao) await db.solicitacaoCotacao.delete({ where: { id: lixoIds.solicitacao } }).catch(() => undefined)
    passos.push({ passo: '8-limpeza', ok: true })

    return NextResponse.json({
      sucesso: passos.every((p) => p.ok),
      passos,
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { passos, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
