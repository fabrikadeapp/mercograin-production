/**
 * BH Grain — Builder do resumo consolidado do dashboard.
 *
 * Carrega propostas/cotações/metas/alertas do workspace e agrega tudo num
 * payload pronto para o frontend. Não escreve nada.
 */

import { db } from '@/lib/db'
import { proximaAcao } from './proxima-acao'
import { previsaoReceita, simularMeta, type RiscoMeta } from './previsao'

export interface DashboardResumo {
  kpis: {
    valorTotalProposto: number
    previsaoReceita: number
    clientesAtivos: number
    propostasAbertas: number
    /** Margem média ponderada das propostas abertas (% — duplica indicadores.qualidade.margemMedia para facilitar acesso na pipeline) */
    margemMedia: number | null
    /** Ticket médio = valorTotalProposto / propostasAbertas (R$) */
    ticketMedio: number | null
  }
  pipeline: PipelineRow[]
  indicadores: {
    funil: {
      totalRecebidos: number
      enviadas: number
      emNegociacao: number
      sucesso: number
      recusadas: number
    }
    qualidade: {
      scoreMedio: number | null
      margemMedia: number | null
      /** Tempo médio entre envio e primeira resposta/atualização da proposta (horas) */
      tempoMedioRespostaH: number | null
      propostasCotacaoVencida: number
      followUpsPendentes: number
    }
    risco: {
      precoVencido: number
      margemBaixa: number
      paradas: number
      semResposta: number
    }
  }
  faturamentoMeta: {
    diario: { date: string; value: number }[]
    metaMensal: number
    atingido: number
    percentualMeta: number
    previsaoMes: number
    simulador: {
      falta: number
      necessarioPorDia: number
      cobrePrevisao: boolean
      risco: RiscoMeta
    } | null
  }
  alertasAbertos: number
  generatedAt: string
}

export interface PipelineRow {
  id: string
  clienteNome: string
  /** Subtítulo do cliente (ex.: 'Trader · GO', 'Produtor · MS'). Calculado a partir de Cliente.tipo + UF do endereço. */
  clienteSubtitulo: string | null
  commodity: string
  quantidade: number | null
  unidade: string | null
  precoCotado: number | null
  valorTotal: number
  margemPercent: number | null
  scoreInterno: number | null
  status: string
  validadeEm: string | null
  previsaoCaixa: string | null
  proximaAcao: string | null
}

const STATUS_ABERTOS = ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao']

export async function buildDashboardResumo(workspaceId: string): Promise<DashboardResumo> {
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const periodo = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}`

  const [propostas, clientesCount, metaRow, alertasCount] = await Promise.all([
    db.proposta.findMany({
      where: { workspaceId },
      orderBy: { atualizadaEm: 'desc' },
      take: 200,
      include: { cliente: { select: { id: true, nome: true, tipo: true, endereco: true } } },
    }),
    db.cliente.count({ where: { workspaceId, ativo: true } }),
    db.metaComercial.findFirst({
      where: { workspaceId, periodo, userId: null, commodity: null },
    }),
    db.commercialAlert.count({ where: { workspaceId, status: 'aberto' } }),
  ])

  const propostasAbertasArr = propostas.filter((p) => STATUS_ABERTOS.includes(p.status.toLowerCase()))
  const valorTotalProposto = sum(propostasAbertasArr.map((p) => Number(p.valorTotal)))
  const prev = previsaoReceita(
    propostasAbertasArr.map((p) => ({
      valorTotal: Number(p.valorTotal),
      status: p.status,
      score: p.scoreInterno,
    }))
  )

  const pipeline: PipelineRow[] = propostasAbertasArr.slice(0, 50).map((p) => buildPipelineRow(p))

  // Faturamento diário (últimos 7 dias) — somente propostas com status 'sucesso'/'concluido'/'faturado'
  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6)
  seteDiasAtras.setHours(0, 0, 0, 0)
  const fechadas = await db.proposta.findMany({
    where: {
      workspaceId,
      status: { in: ['sucesso', 'concluido', 'faturado'] },
      atualizadaEm: { gte: seteDiasAtras },
    },
    select: { atualizadaEm: true, valorTotal: true },
  })
  const diario = aggregateByDay(fechadas, seteDiasAtras)
  const atingidoMes = await sumFechadasNoMes(workspaceId, inicioMes)

  const metaMensal = metaRow ? Number(metaRow.valorMeta) : 0
  const percentualMeta = metaMensal > 0 ? Math.round((atingidoMes / metaMensal) * 1000) / 10 : 0
  const previsaoMes = atingidoMes + prev.ponderado

  const diasUteis = diasUteisRestantesNoMes()
  const simulador =
    metaMensal > 0
      ? simularMeta({
          meta: metaMensal,
          atingido: atingidoMes,
          diasUteisRestantes: diasUteis,
          previsaoPonderada: prev.ponderado,
        })
      : null

  // Funil — usa propostas dos últimos 90 dias para indicadores
  const noventa = new Date()
  noventa.setDate(noventa.getDate() - 90)
  const propostasFunil = await db.proposta.findMany({
    where: { workspaceId, criadaEm: { gte: noventa } },
    select: { status: true, scoreInterno: true, margemPercent: true, validadeCotacao: true, enviadaEm: true, atualizadaEm: true, clienteId: true },
  })
  const funil = {
    totalRecebidos: propostasFunil.length,
    enviadas: propostasFunil.filter((p) => p.enviadaEm != null).length,
    emNegociacao: propostasFunil.filter((p) => /negocia/.test(p.status.toLowerCase())).length,
    sucesso: propostasFunil.filter((p) => ['sucesso', 'aceita', 'concluido', 'faturado'].includes(p.status.toLowerCase())).length,
    recusadas: propostasFunil.filter((p) => p.status.toLowerCase() === 'recusada').length,
  }

  const agora = new Date()
  const scores = propostasFunil.map((p) => p.scoreInterno).filter((s): s is number => s != null)
  const margens = propostasFunil.map((p) => (p.margemPercent != null ? Number(p.margemPercent) : null)).filter((s): s is number => s != null)
  const propostasCotacaoVencida = propostasFunil.filter((p) => p.validadeCotacao != null && p.validadeCotacao < agora).length

  // Propostas em "follow-up pendente": enviada há ≥4h sem nova atualização e status aberto
  const propostasFollowUp = propostasFunil.filter((p) => {
    if (!p.enviadaEm) return false
    const h = (agora.getTime() - p.enviadaEm.getTime()) / 1000 / 60 / 60
    return h >= 4 && /enviada|negocia/.test(p.status.toLowerCase())
  })
  // Clientes sem resposta = distinct dos follow-up pendentes
  const clientesSemRespostaSet = new Set(propostasFollowUp.map((p) => p.clienteId))

  // Tempo médio de resposta = horas entre enviadaEm e atualizadaEm para propostas
  // que progrediram além do envio (em_negociacao, sucesso, recusada).
  const propostasComResposta = propostasFunil.filter((p) => {
    if (!p.enviadaEm) return false
    const s = p.status.toLowerCase()
    if (/^(rascunho|pendente|enviada|pronta)/.test(s)) return false
    return p.atualizadaEm.getTime() > p.enviadaEm.getTime()
  })
  const temposResposta = propostasComResposta.map(
    (p) => (p.atualizadaEm.getTime() - p.enviadaEm!.getTime()) / 1000 / 60 / 60
  )
  const tempoMedioRespostaH = temposResposta.length > 0
    ? round2(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
    : null

  const indicadores = {
    funil,
    qualidade: {
      scoreMedio: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      margemMedia: margens.length > 0 ? round2(margens.reduce((a, b) => a + b, 0) / margens.length) : null,
      tempoMedioRespostaH,
      propostasCotacaoVencida,
      followUpsPendentes: propostasFollowUp.length,
    },
    risco: {
      precoVencido: propostasCotacaoVencida,
      margemBaixa: propostasFunil.filter((p) => p.margemPercent != null && Number(p.margemPercent) < 3).length,
      paradas: propostasFunil.filter((p) => {
        if (!p.enviadaEm) return false
        const diff = (agora.getTime() - p.enviadaEm.getTime()) / 1000 / 60 / 60
        return diff > 72 && /negocia|enviada/.test(p.status.toLowerCase())
      }).length,
      semResposta: clientesSemRespostaSet.size,
    },
  }

  const ticketMedio = propostasAbertasArr.length > 0
    ? round2(valorTotalProposto / propostasAbertasArr.length)
    : null

  return {
    kpis: {
      valorTotalProposto,
      previsaoReceita: prev.ponderado,
      clientesAtivos: clientesCount,
      propostasAbertas: propostasAbertasArr.length,
      margemMedia: indicadores.qualidade.margemMedia,
      ticketMedio,
    },
    pipeline,
    indicadores,
    faturamentoMeta: {
      diario,
      metaMensal,
      atingido: atingidoMes,
      percentualMeta,
      previsaoMes: round2(previsaoMes),
      simulador,
    },
    alertasAbertos: alertasCount,
    generatedAt: new Date().toISOString(),
  }
}

type PropostaWithCliente = Awaited<ReturnType<typeof loadPropostaSample>>[number]
async function loadPropostaSample() {
  return db.proposta.findMany({
    take: 1,
    include: { cliente: { select: { id: true, nome: true, tipo: true, endereco: true } } },
  })
}

const TIPO_CLIENTE_LABEL: Record<string, string> = {
  comprador: 'Comprador',
  vendedor: 'Produtor',
  ambos: 'Trader',
}

/** Extrai UF (2 letras maiúsculas) do final do endereço, se existir. */
function extrairUf(endereco: string | null | undefined): string | null {
  if (!endereco || typeof endereco !== 'string') return null
  // Padrões: "..., Cidade - MG", "..., Goiânia/GO", "... GO 74000"
  const m = endereco.match(/[\s\-/,]([A-Z]{2})(?:\s|$|[,.\-])/)
  if (m) return m[1]
  // Fallback: 2 letras maiúsculas em qualquer lugar no fim
  const m2 = endereco.trim().match(/([A-Z]{2})\s*\d*\s*$/)
  return m2 ? m2[1] : null
}

function buildSubtituloCliente(cliente: { tipo?: string | null; endereco?: string | null }): string | null {
  const tipoLabel = cliente.tipo ? TIPO_CLIENTE_LABEL[cliente.tipo] ?? null : null
  const uf = extrairUf(cliente.endereco)
  if (!tipoLabel && !uf) return null
  if (tipoLabel && uf) return `${tipoLabel} · ${uf}`
  return tipoLabel ?? uf
}

function buildPipelineRow(p: PropostaWithCliente): PipelineRow {
  const graos = p.graos as { commodity?: string; quantidade?: number; unidade?: string; preco?: number } | null
  const commodity = graos?.commodity ?? '—'
  const quantidade = graos?.quantidade ?? null
  const unidade = graos?.unidade ?? null
  const precoCotado = graos?.preco ?? null
  const acao = proximaAcao({
    status: p.status,
    margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
    margemMinima: null,
    validadeCotacaoRestanteMin: p.validadeCotacao ? Math.round((p.validadeCotacao.getTime() - Date.now()) / 60000) : null,
    horasSemResposta: p.enviadaEm ? Math.round((Date.now() - p.enviadaEm.getTime()) / 3600000) : null,
    precisaAprovacao: false,
    dadosCompletos: !!commodity && quantidade != null,
  })
  return {
    id: p.id,
    clienteNome: p.cliente.nome,
    clienteSubtitulo: buildSubtituloCliente(p.cliente),
    commodity,
    quantidade,
    unidade,
    precoCotado,
    valorTotal: Number(p.valorTotal),
    margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
    scoreInterno: p.scoreInterno,
    status: p.status,
    validadeEm: p.validadeEm.toISOString(),
    previsaoCaixa: p.enviadaEm ? new Date(p.enviadaEm.getTime() + 14 * 24 * 3600 * 1000).toISOString() : null,
    proximaAcao: acao.motivo,
  }
}

async function sumFechadasNoMes(workspaceId: string, inicioMes: Date): Promise<number> {
  const r = await db.proposta.aggregate({
    where: {
      workspaceId,
      status: { in: ['sucesso', 'concluido', 'faturado'] },
      atualizadaEm: { gte: inicioMes },
    },
    _sum: { valorTotal: true },
  })
  return r._sum.valorTotal ? Number(r._sum.valorTotal) : 0
}

function aggregateByDay(rows: { atualizadaEm: Date; valorTotal: { toString(): string } }[], from: Date): { date: string; value: number }[] {
  const map = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    map.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of rows) {
    const k = r.atualizadaEm.toISOString().slice(0, 10)
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(r.valorTotal))
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, value: round2(value) }))
}

function diasUteisRestantesNoMes(): number {
  const now = new Date()
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  let dias = 0
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= fim) {
    const wd = cursor.getDay()
    if (wd !== 0 && wd !== 6) dias++
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

function sum(arr: number[]): number {
  return round2(arr.reduce((a, b) => a + b, 0))
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
