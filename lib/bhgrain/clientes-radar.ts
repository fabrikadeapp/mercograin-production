/**
 * BH Grain — Radar de clientes (read-only).
 *
 * Classifica clientes em buckets (quente/recorrente/em_risco/novo_lead/sem_resposta/follow_up_pendente)
 * baseado em sinais: propostas abertas, último contato, score, taxa de sucesso.
 */

import { db } from '@/lib/db'

export type RadarTag =
  | 'quente'
  | 'recorrente'
  | 'em_risco'
  | 'novo_lead'
  | 'sem_resposta'
  | 'follow_up_pendente'

export interface ClienteRadarItem {
  id: string
  nome: string
  cidade: string | null
  uf: string | null
  iniciais: string
  status: 'ativo' | 'lead' | 'novo' | 'inativo'
  tag: RadarTag | null
  scoreMedio: number | null
  propostasAbertas: number
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

function parseEndereco(endereco: string | null): { cidade: string | null; uf: string | null } {
  if (!endereco) return { cidade: null, uf: null }
  // Heurística simples: "..., Cidade/UF" ou "Cidade - UF"
  const m1 = endereco.match(/([A-Za-zÀ-ÿ\s]+)\/([A-Z]{2})/)
  if (m1) return { cidade: m1[1].trim(), uf: m1[2] }
  const m2 = endereco.match(/([A-Za-zÀ-ÿ\s]+)\s*-\s*([A-Z]{2})/)
  if (m2) return { cidade: m2[1].trim(), uf: m2[2] }
  return { cidade: null, uf: null }
}

function clienteStatus(c: { ativo: boolean; statusCadastral: string; createdAt: Date }): ClienteRadarItem['status'] {
  if (!c.ativo) return 'inativo'
  if (c.statusCadastral === 'analise' || c.statusCadastral === 'rascunho') return 'lead'
  const dias = (Date.now() - c.createdAt.getTime()) / 86400000
  if (dias < 14) return 'novo'
  return 'ativo'
}

export interface ListClientesRadarOpts {
  periodo?: 'hoje' | '7d' | '15d' | '30d' | 'custom' | null
  commodity?: 'soja' | 'milho' | 'trigo' | null
  dataInicio?: string | null
  dataFim?: string | null
}

/** Resolve janela [start, end] a partir das opts de período. */
function janelaFromOpts(opts: ListClientesRadarOpts): { start: Date; end: Date } | null {
  if (!opts.periodo) return null
  const end = new Date()
  if (opts.periodo === 'custom' && opts.dataInicio && opts.dataFim) {
    const s = new Date(opts.dataInicio + 'T00:00:00')
    const e = new Date(opts.dataFim + 'T23:59:59')
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) return { start: s, end: e }
  }
  const start = new Date(end)
  switch (opts.periodo) {
    case 'hoje':
      start.setHours(0, 0, 0, 0)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '15d':
      start.setDate(start.getDate() - 15)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    default:
      return null
  }
  return { start, end }
}

export async function listClientesRadar(
  workspaceId: string,
  limit = 8,
  opts: ListClientesRadarOpts = {}
): Promise<ClienteRadarItem[]> {
  const janela = janelaFromOpts(opts)
  const propostasWhere = janela
    ? {
        status: { in: ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao'] },
        OR: [
          { criadaEm: { gte: janela.start, lte: janela.end } },
          { atualizadaEm: { gte: janela.start, lte: janela.end } },
        ],
      }
    : { status: { in: ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao'] } }

  const clientes = await db.cliente.findMany({
    where: { workspaceId },
    take: 100, // pega N e ordena depois
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      nome: true,
      endereco: true,
      ativo: true,
      statusCadastral: true,
      scoreRelacionamento: true,
      createdAt: true,
      propostas: {
        where: propostasWhere,
        select: { id: true, scoreInterno: true, enviadaEm: true, status: true, graos: true },
        take: 50,
      },
    },
  })

  const filtroCommodity = opts.commodity
  const items: ClienteRadarItem[] = clientes.map((c) => {
    const { cidade, uf } = parseEndereco(c.endereco)
    // Aplica filtro de commodity em memória (graos é JSON)
    const propostasFiltradas = filtroCommodity
      ? c.propostas.filter((p) => {
          const graos = p.graos as Array<{ grao?: string; commodity?: string }> | null
          if (!Array.isArray(graos)) return false
          return graos.some(
            (g) => (g?.commodity ?? g?.grao ?? '').toLowerCase() === filtroCommodity
          )
        })
      : c.propostas
    const scores = propostasFiltradas.map((p) => p.scoreInterno).filter((s): s is number => s != null)
    const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    let tag: RadarTag | null = null
    const status = clienteStatus(c)

    if (status === 'novo') tag = 'novo_lead'

    // Sem resposta: tem proposta enviada há >7d e nenhuma resposta
    const enviadaAntiga = propostasFiltradas.find((p) => p.enviadaEm && (Date.now() - p.enviadaEm.getTime()) / 86400000 > 7)
    if (enviadaAntiga) tag = 'sem_resposta'

    // Follow-up pendente: enviada há 4-24h sem outra atualização
    const enviadaRecente = propostasFiltradas.find((p) => {
      if (!p.enviadaEm) return false
      const h = (Date.now() - p.enviadaEm.getTime()) / 3600000
      return h >= 4 && h < 168 // 1 semana
    })
    if (enviadaRecente && !tag) tag = 'follow_up_pendente'

    // Quente: score médio >= 75
    if (scoreMedio != null && scoreMedio >= 75) tag = 'quente'

    // Em risco: score médio < 40 com propostas abertas
    if (scoreMedio != null && scoreMedio < 40 && propostasFiltradas.length > 0) tag = 'em_risco'

    // Recorrente: ranking de relacionamento alto
    if (!tag && c.scoreRelacionamento != null && c.scoreRelacionamento >= 700) tag = 'recorrente'

    return {
      id: c.id,
      nome: c.nome,
      cidade,
      uf,
      iniciais: iniciais(c.nome),
      status,
      tag,
      scoreMedio,
      propostasAbertas: propostasFiltradas.length,
    }
  })

  // Ordena: quente > follow_up > sem_resposta > em_risco > novo > recorrente > sem tag
  const prioridade: Record<string, number> = {
    quente: 0,
    follow_up_pendente: 1,
    sem_resposta: 2,
    em_risco: 3,
    novo_lead: 4,
    recorrente: 5,
  }
  items.sort((a, b) => {
    const pa = a.tag ? prioridade[a.tag] ?? 99 : 99
    const pb = b.tag ? prioridade[b.tag] ?? 99 : 99
    if (pa !== pb) return pa - pb
    return (b.scoreMedio ?? 0) - (a.scoreMedio ?? 0)
  })

  return items.slice(0, limit)
}
