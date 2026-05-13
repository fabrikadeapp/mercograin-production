/**
 * BH Grain — Detalhe completo de uma proposta (drawer).
 *
 * Agrega: dados base + score (com fatores) + margem + comparativo mercado +
 * próxima ação + timeline (de AuditLog).
 */

import { db } from '@/lib/db'
import { calcularScore } from './scoring'
import { calcularMargem } from './margem'
import { proximaAcao } from './proxima-acao'
import { sugerirFollowUp } from './follow-up'

export interface PropostaDetalheResumo {
  id: string
  numero: string
  status: string
  cliente: { id: string; nome: string }
  commodity: string
  quantidade: number | null
  unidade: string | null
  precoCotado: number | null
  valorTotal: number
  validadeEm: string
  previsaoCaixa: string | null
}

export interface ScoreDetalhe {
  score: number | null
  label: string | null
  fatoresPositivos: string[]
  fatoresNegativos: string[]
}

export interface MargemDetalhe {
  precoProposto: number | null
  custoEstimado: number | null
  lucroBruto: number | null
  margemPercent: number | null
  margemMinima: number | null
  abaixoDoMinimo: boolean
}

export interface CotacaoDetalhe {
  fonte: string | null
  capturadaEm: string | null
  validadeCotacao: string | null
  minutosRestantes: number | null
  vencida: boolean
}

export interface ComparativoMercado {
  precoMercadoAtual: number | null
  precoProposto: number | null
  diferencaAbs: number | null
  diferencaPercent: number | null
  classificacao: 'competitiva' | 'agressiva' | 'conservadora' | 'margem_baixa' | 'risco_perda' | null
}

export interface AcaoDetalhe {
  acao: string
  motivo: string
  followUp: { precisa: boolean; mensagem: string; motivo: string } | null
}

export interface TimelineEvento {
  tipo: string
  ocorridoEm: string
  ator: string
  observacao: string | null
}

export interface AuditoriaDetalhe {
  criadoEm: string
  enviadoEm: string | null
  atualizadoEm: string
  cotacaoFonte: string | null
  cotacaoCapturadaEm: string | null
  margemAplicada: number | null
  /** Quem solicitou aprovação (último ciclo) */
  solicitante: string | null
  /** Decisões da última aprovação */
  aprovadores: { etapa: number; userId: string; decisao: string; em: string; motivo: string | null }[]
  statusAprovacao: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada' | 'expirada' | null
}

export interface LogisticaDetalhe {
  origem: string | null
  destino: string | null
  localEntrega: string | null
  modalTransporte: string | null
  freteTipo: string | null
  freteCustoTotal: number | null
  freteCustoUnit: number | null
  prazoLogistico: string | null
  incoterm: string | null
  armazemOrigem: { id: string; nome: string } | null
  armazemDestino: { id: string; nome: string } | null
  pendenteInformacao: boolean
}

export interface EstoqueDetalhe {
  lote: { id: string; numero: string; cultura: string; qtdAtualSc: number; armazem: { nome: string } } | null
  /** Volume da proposta vs disponível. true = volume excede ou sem lote. */
  excedeDisponivel: boolean
  quantidadeProposta: number | null
}

export interface QualidadeDetalhe {
  umidadeMax: number | null
  impurezaMax: number | null
  ph: number | null
  proteinaMin: number | null
  ardidosMax: number | null
  avariadosMax: number | null
  padraoComercial: string | null
  observacoes: string | null
  preenchida: boolean
}

export interface PropostaDetalhe {
  resumo: PropostaDetalheResumo
  score: ScoreDetalhe
  margem: MargemDetalhe
  cotacao: CotacaoDetalhe
  mercado: ComparativoMercado
  acao: AcaoDetalhe
  timeline: TimelineEvento[]
  auditoria: AuditoriaDetalhe
  logistica: LogisticaDetalhe
  estoque: EstoqueDetalhe
  qualidade: QualidadeDetalhe
}

interface PropostaGraos {
  commodity?: string
  quantidade?: number
  unidade?: string
  preco?: number
}

export async function buildPropostaDetalhe(workspaceId: string, propostaId: string): Promise<PropostaDetalhe | null> {
  const p = await db.proposta.findFirst({
    where: { id: propostaId, workspaceId },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          scoreRelacionamento: true,
          propostas: {
            where: { status: { in: ['sucesso', 'aceita', 'concluido', 'recusada'] } },
            select: { status: true },
          },
        },
      },
      armazemOrigemRef: { select: { id: true, nome: true } },
      armazemDestinoRef: { select: { id: true, nome: true } },
      loteEstoqueRef: {
        select: {
          id: true,
          numero: true,
          cultura: true,
          qtdAtualSc: true,
          armazem: { select: { nome: true } },
        },
      },
    },
  })
  if (!p) return null

  const graos = (p.graos as PropostaGraos | null) ?? {}
  const commodity = graos.commodity ?? '—'
  const quantidade = graos.quantidade ?? null
  const unidade = graos.unidade ?? null
  const precoCotado = graos.preco ?? null

  // Cotação atual do mercado (mesma commodity)
  const grao = commodity.toLowerCase().includes('soja')
    ? 'soja'
    : commodity.toLowerCase().includes('milho')
      ? 'milho'
      : commodity.toLowerCase().includes('trigo')
        ? 'trigo'
        : null
  const cotacaoMercado = grao
    ? await db.cotacao.findFirst({ where: { grao }, orderBy: { data: 'desc' } })
    : null
  const precoMercado = cotacaoMercado ? Number(cotacaoMercado.close ?? cotacaoMercado.preco) : null

  // Validade da cotação
  const minutosRestantes = p.validadeCotacao
    ? Math.round((p.validadeCotacao.getTime() - Date.now()) / 60000)
    : null
  const vencida = minutosRestantes != null && minutosRestantes <= 0

  // Histórico do cliente para score
  const fechadas = p.cliente.propostas
  const sucessos = fechadas.filter((x) => ['sucesso', 'aceita', 'concluido'].includes(x.status.toLowerCase())).length
  const taxaSucesso = fechadas.length > 0 ? sucessos / fechadas.length : null

  const score = calcularScore({
    clienteRecorrente: (p.cliente.scoreRelacionamento ?? 0) >= 700,
    clienteTaxaSucessoHistorica: taxaSucesso,
    ticketMedioCliente: null,
    precoProposta: precoCotado ?? 0,
    precoMercadoAtual: precoMercado,
    margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
    margemMinima: null,
    diasSemContato: null,
    statusProposta: p.status,
    validadeCotacaoRestanteMin: minutosRestantes,
  })

  // Margem recalculada (se houver custo)
  const margemCalc =
    precoCotado != null && quantidade != null && p.custoEstimado != null
      ? calcularMargem({
          precoVenda: precoCotado,
          custoUnitario: Number(p.custoEstimado) / Math.max(1, quantidade),
          quantidade,
        })
      : null

  // Comparativo de mercado
  let mercado: ComparativoMercado = {
    precoMercadoAtual: precoMercado,
    precoProposto: precoCotado,
    diferencaAbs: null,
    diferencaPercent: null,
    classificacao: null,
  }
  if (precoMercado != null && precoCotado != null && precoMercado > 0) {
    const diffAbs = precoCotado - precoMercado
    const diffPct = (diffAbs / precoMercado) * 100
    let classificacao: ComparativoMercado['classificacao'] = 'competitiva'
    if (diffPct >= 5) classificacao = 'agressiva'
    else if (diffPct <= -3) classificacao = 'conservadora'
    if (p.margemPercent != null && Number(p.margemPercent) < 3) classificacao = 'margem_baixa'
    if (score.label === 'risco') classificacao = 'risco_perda'
    mercado = { precoMercadoAtual: precoMercado, precoProposto: precoCotado, diferencaAbs: diffAbs, diferencaPercent: diffPct, classificacao }
  }

  const horasSemResposta = p.enviadaEm ? (Date.now() - p.enviadaEm.getTime()) / 3600000 : null
  const acao = proximaAcao({
    status: p.status,
    margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
    margemMinima: null,
    validadeCotacaoRestanteMin: minutosRestantes,
    horasSemResposta,
    precisaAprovacao: false,
    dadosCompletos: !!commodity && quantidade != null,
  })

  let followUp = null
  if (horasSemResposta != null && horasSemResposta >= 4) {
    const f = sugerirFollowUp({
      clienteNome: p.cliente.nome,
      commodity,
      horasDesdeEnvio: horasSemResposta,
      status: p.status,
      validadeCotacaoRestanteMin: minutosRestantes,
    })
    if (f.precisa) followUp = { precisa: true, mensagem: f.mensagem, motivo: f.motivo }
  }

  // Timeline: combina eventos sintéticos da Proposta (criadaEm, cotacaoCapturadaEm,
  // enviadaEm, atualizadaEm) + AuditLogs específicos + decisões de Aprovação.
  const [audit, aprovacoes] = await Promise.all([
    db.auditLog.findMany({
      where: { entidade: 'Proposta', entidadeId: propostaId, workspaceId },
      orderBy: { criadoEm: 'asc' },
      take: 100,
    }),
    db.aprovacao.findMany({
      where: { workspaceId, entidadeTipo: 'Proposta', entidadeId: propostaId },
      include: { decisoes: { orderBy: { decididoEm: 'asc' } }, solicitante: { select: { email: true } } },
    }),
  ])

  const timeline: TimelineEvento[] = []

  // Evento: Proposta criada
  timeline.push({
    tipo: 'Proposta criada',
    ocorridoEm: p.criadaEm.toISOString(),
    ator: 'sistema',
    observacao: `Status: ${p.status}`,
  })

  // Evento: Cotação capturada (se houver)
  if (p.cotacaoCapturadaEm) {
    timeline.push({
      tipo: 'Preço consultado',
      ocorridoEm: p.cotacaoCapturadaEm.toISOString(),
      ator: 'sistema',
      observacao: p.cotacaoFonte ? `Fonte: ${p.cotacaoFonte}` : null,
    })
  }

  // Auditoria: cada AuditLog vira um evento dedicado
  for (const a of audit) {
    timeline.push({
      tipo: a.acao,
      ocorridoEm: a.criadoEm.toISOString(),
      ator: a.userId,
      observacao: null,
    })
  }

  // Aprovações: solicitação + cada decisão
  for (const ap of aprovacoes) {
    timeline.push({
      tipo: 'Aprovação solicitada',
      ocorridoEm: ap.createdAt.toISOString(),
      ator: ap.solicitante.email ?? ap.solicitanteId,
      observacao: ap.observacoes ?? null,
    })
    for (const d of ap.decisoes) {
      timeline.push({
        tipo: d.decisao === 'aprovado' ? `Etapa ${d.etapa} aprovada` : `Etapa ${d.etapa} rejeitada`,
        ocorridoEm: d.decididoEm.toISOString(),
        ator: d.aprovadorId,
        observacao: d.motivo ?? null,
      })
    }
  }

  // Evento: Proposta enviada
  if (p.enviadaEm) {
    timeline.push({
      tipo: 'Proposta enviada',
      ocorridoEm: p.enviadaEm.toISOString(),
      ator: 'sistema',
      observacao: null,
    })
  }

  // Última atualização (se diferente das outras)
  if (p.atualizadaEm.getTime() !== p.criadaEm.getTime() && (!p.enviadaEm || p.atualizadaEm.getTime() !== p.enviadaEm.getTime())) {
    timeline.push({
      tipo: 'Proposta atualizada',
      ocorridoEm: p.atualizadaEm.toISOString(),
      ator: 'sistema',
      observacao: `Status atual: ${p.status}`,
    })
  }

  // Ordena por timestamp
  timeline.sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm))

  return {
    resumo: {
      id: p.id,
      numero: p.numero,
      status: p.status,
      cliente: { id: p.cliente.id, nome: p.cliente.nome },
      commodity,
      quantidade,
      unidade,
      precoCotado,
      valorTotal: Number(p.valorTotal),
      validadeEm: p.validadeEm.toISOString(),
      previsaoCaixa: p.enviadaEm ? new Date(p.enviadaEm.getTime() + 14 * 86400000).toISOString() : null,
    },
    score: {
      score: p.scoreInterno ?? score.score,
      label: p.scoreLabel ?? score.label,
      fatoresPositivos: score.fatoresPositivos,
      fatoresNegativos: score.fatoresNegativos,
    },
    margem: {
      precoProposto: precoCotado,
      custoEstimado: p.custoEstimado != null ? Number(p.custoEstimado) : margemCalc?.custoTotal ?? null,
      lucroBruto: p.lucroBrutoEstimado != null ? Number(p.lucroBrutoEstimado) : margemCalc?.lucroBruto ?? null,
      margemPercent: p.margemPercent != null ? Number(p.margemPercent) : margemCalc?.margemPercent ?? null,
      margemMinima: null,
      abaixoDoMinimo: false,
    },
    cotacao: {
      fonte: p.cotacaoFonte,
      capturadaEm: p.cotacaoCapturadaEm?.toISOString() ?? null,
      validadeCotacao: p.validadeCotacao?.toISOString() ?? null,
      minutosRestantes,
      vencida,
    },
    mercado,
    acao: { acao: acao.acao, motivo: acao.motivo, followUp },
    timeline,
    auditoria: buildAuditoriaDetalhe(p, aprovacoes),
    logistica: buildLogisticaDetalhe(p),
    estoque: buildEstoqueDetalhe(p, quantidade),
    qualidade: buildQualidadeDetalhe(p.qualidadeSpec),
  }
}

type PropostaComRefs = Awaited<ReturnType<typeof loadPropostaForDetalhe>>
async function loadPropostaForDetalhe() {
  // Tipo helper para inferir o shape
  return db.proposta.findFirst({
    where: { id: '_' },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          scoreRelacionamento: true,
          propostas: { select: { status: true } },
        },
      },
      armazemOrigemRef: { select: { id: true, nome: true } },
      armazemDestinoRef: { select: { id: true, nome: true } },
      loteEstoqueRef: {
        select: {
          id: true,
          numero: true,
          cultura: true,
          qtdAtualSc: true,
          armazem: { select: { nome: true } },
        },
      },
    },
  })
}

interface AprovacaoWithDecisoes {
  status: string
  createdAt: Date
  observacoes: string | null
  solicitante: { email: string | null } | null
  solicitanteId: string
  decisoes: { etapa: number; aprovadorId: string; decisao: string; decididoEm: Date; motivo: string | null }[]
}

function buildAuditoriaDetalhe(p: NonNullable<PropostaComRefs>, aprovacoes: AprovacaoWithDecisoes[]): AuditoriaDetalhe {
  // Última aprovação por createdAt
  const last = aprovacoes.length > 0
    ? aprovacoes.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    : null

  return {
    criadoEm: p.criadaEm.toISOString(),
    enviadoEm: p.enviadaEm?.toISOString() ?? null,
    atualizadoEm: p.atualizadaEm.toISOString(),
    cotacaoFonte: p.cotacaoFonte,
    cotacaoCapturadaEm: p.cotacaoCapturadaEm?.toISOString() ?? null,
    margemAplicada: p.margemPercent != null ? Number(p.margemPercent) : null,
    solicitante: last?.solicitante?.email ?? last?.solicitanteId ?? null,
    aprovadores: last
      ? last.decisoes.map((d) => ({
          etapa: d.etapa,
          userId: d.aprovadorId,
          decisao: d.decisao,
          em: d.decididoEm.toISOString(),
          motivo: d.motivo,
        }))
      : [],
    statusAprovacao: last ? (last.status as AuditoriaDetalhe['statusAprovacao']) : null,
  }
}

function buildLogisticaDetalhe(p: NonNullable<PropostaComRefs>): LogisticaDetalhe {
  const pendente =
    !p.localEntrega && !p.armazemDestinoRef && !p.modalTransporte && !p.freteTipo && !p.destino
  return {
    origem: p.origem,
    destino: p.destino,
    localEntrega: p.localEntrega,
    modalTransporte: p.modalTransporte,
    freteTipo: p.freteTipo,
    freteCustoTotal: p.freteCustoTotal != null ? Number(p.freteCustoTotal) : null,
    freteCustoUnit: p.freteCustoUnit != null ? Number(p.freteCustoUnit) : null,
    prazoLogistico: p.prazoLogistico?.toISOString() ?? null,
    incoterm: p.incoterm,
    armazemOrigem: p.armazemOrigemRef ?? null,
    armazemDestino: p.armazemDestinoRef ?? null,
    pendenteInformacao: pendente,
  }
}

function buildEstoqueDetalhe(p: NonNullable<PropostaComRefs>, quantidade: number | null): EstoqueDetalhe {
  if (!p.loteEstoqueRef) {
    return { lote: null, excedeDisponivel: quantidade != null && quantidade > 0, quantidadeProposta: quantidade }
  }
  const disponivel = Number(p.loteEstoqueRef.qtdAtualSc ?? 0)
  return {
    lote: {
      id: p.loteEstoqueRef.id,
      numero: p.loteEstoqueRef.numero,
      cultura: p.loteEstoqueRef.cultura,
      qtdAtualSc: disponivel,
      armazem: { nome: p.loteEstoqueRef.armazem.nome },
    },
    excedeDisponivel: quantidade != null && quantidade > disponivel,
    quantidadeProposta: quantidade,
  }
}

interface QualidadeSpecRaw {
  umidadeMax?: number
  impurezaMax?: number
  ph?: number
  proteinaMin?: number
  ardidosMax?: number
  avariadosMax?: number
  padraoComercial?: string
  observacoes?: string
}

function buildQualidadeDetalhe(raw: unknown): QualidadeDetalhe {
  const q = (raw && typeof raw === 'object' ? (raw as QualidadeSpecRaw) : {}) as QualidadeSpecRaw
  const preenchida =
    q.umidadeMax != null ||
    q.impurezaMax != null ||
    q.ph != null ||
    q.proteinaMin != null ||
    q.ardidosMax != null ||
    q.avariadosMax != null ||
    !!q.padraoComercial
  return {
    umidadeMax: q.umidadeMax ?? null,
    impurezaMax: q.impurezaMax ?? null,
    ph: q.ph ?? null,
    proteinaMin: q.proteinaMin ?? null,
    ardidosMax: q.ardidosMax ?? null,
    avariadosMax: q.avariadosMax ?? null,
    padraoComercial: q.padraoComercial ?? null,
    observacoes: q.observacoes ?? null,
    preenchida,
  }
}
