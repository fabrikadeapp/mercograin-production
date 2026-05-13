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

export async function listClientesRadar(workspaceId: string, limit = 8): Promise<ClienteRadarItem[]> {
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
        where: { status: { in: ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao'] } },
        select: { id: true, scoreInterno: true, enviadaEm: true, status: true },
        take: 50,
      },
    },
  })

  const items: ClienteRadarItem[] = clientes.map((c) => {
    const { cidade, uf } = parseEndereco(c.endereco)
    const scores = c.propostas.map((p) => p.scoreInterno).filter((s): s is number => s != null)
    const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    let tag: RadarTag | null = null
    const status = clienteStatus(c)

    if (status === 'novo') tag = 'novo_lead'

    // Sem resposta: tem proposta enviada há >7d e nenhuma resposta
    const enviadaAntiga = c.propostas.find((p) => p.enviadaEm && (Date.now() - p.enviadaEm.getTime()) / 86400000 > 7)
    if (enviadaAntiga) tag = 'sem_resposta'

    // Follow-up pendente: enviada há 4-24h sem outra atualização
    const enviadaRecente = c.propostas.find((p) => {
      if (!p.enviadaEm) return false
      const h = (Date.now() - p.enviadaEm.getTime()) / 3600000
      return h >= 4 && h < 168 // 1 semana
    })
    if (enviadaRecente && !tag) tag = 'follow_up_pendente'

    // Quente: score médio >= 75
    if (scoreMedio != null && scoreMedio >= 75) tag = 'quente'

    // Em risco: score médio < 40 com propostas abertas
    if (scoreMedio != null && scoreMedio < 40 && c.propostas.length > 0) tag = 'em_risco'

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
      propostasAbertas: c.propostas.length,
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
