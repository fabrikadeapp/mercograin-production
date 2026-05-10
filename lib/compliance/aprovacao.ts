/**
 * Workflow de aprovação multi-nível — Epic 5.
 * Pure functions: avaliação de gatilhos + cálculo da próxima etapa.
 */

export type AprovacaoEntidade =
  | 'contrato'
  | 'fixacao'
  | 'washout'
  | 'adiantamento'
  | 'nf_emissao'

export interface AprovacaoEtapa {
  ordem: number
  /** Role do workspace que pode aprovar nesta etapa: 'owner' | 'admin' | 'gerente' */
  role: string
  nome: string
}

export interface AprovacaoCondicao {
  valorMinimo?: number
  qtdMinimaSc?: number
  /** Se true, sempre dispara independente de valor */
  sempre?: boolean
}

export interface AprovacaoDecisaoInput {
  aprovacaoId: string
  etapa: number
  aprovadorId: string
  decisao: 'aprovado' | 'rejeitado'
  motivo?: string
}

export interface AprovacaoStatus {
  proximaEtapa: number | null
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada'
  bloqueado: boolean
  prazoEtapaAtual: Date
}

export interface EntidadeTrigger {
  tipo: AprovacaoEntidade
  valorTotal?: number
  qtdSc?: number
}

/**
 * Decide se um workflow deve ser disparado por uma entidade recém-criada.
 */
export function deveDispararWorkflow(
  workflow: { entidade: string; condicao: any; ativo: boolean },
  entidade: EntidadeTrigger
): boolean {
  if (!workflow.ativo) return false
  if (workflow.entidade !== entidade.tipo) return false

  const cond: AprovacaoCondicao =
    typeof workflow.condicao === 'object' && workflow.condicao !== null
      ? (workflow.condicao as AprovacaoCondicao)
      : {}

  if (cond.sempre === true) return true

  if (typeof cond.valorMinimo === 'number') {
    if (typeof entidade.valorTotal !== 'number') return false
    if (entidade.valorTotal < cond.valorMinimo) return false
  }
  if (typeof cond.qtdMinimaSc === 'number') {
    if (typeof entidade.qtdSc !== 'number') return false
    if (entidade.qtdSc < cond.qtdMinimaSc) return false
  }

  // Pelo menos uma condição precisa ter sido satisfeita
  const temAlgumaCondicao =
    typeof cond.valorMinimo === 'number' ||
    typeof cond.qtdMinimaSc === 'number'
  return temAlgumaCondicao

}

/**
 * Processa uma decisão sobre uma aprovação em curso.
 * Retorna o novo status calculado (não persiste — caller faz isso).
 */
export function processarDecisao(
  workflow: { etapas: any[]; slaHoras: number },
  aprovacao: { etapaAtual: number; totalEtapas: number; decisoes: any[] },
  novaDecisao: AprovacaoDecisaoInput,
  agora: Date = new Date()
): AprovacaoStatus {
  if (novaDecisao.etapa !== aprovacao.etapaAtual) {
    throw new Error(
      `Decisão refere-se à etapa ${novaDecisao.etapa} mas etapa atual é ${aprovacao.etapaAtual}`
    )
  }

  if (novaDecisao.decisao === 'rejeitado') {
    return {
      proximaEtapa: null,
      status: 'rejeitada',
      bloqueado: true,
      prazoEtapaAtual: agora,
    }
  }

  // aprovado
  if (aprovacao.etapaAtual >= aprovacao.totalEtapas) {
    return {
      proximaEtapa: null,
      status: 'aprovada',
      bloqueado: false,
      prazoEtapaAtual: agora,
    }
  }

  const proxima = aprovacao.etapaAtual + 1
  const slaMs = (workflow.slaHoras || 48) * 60 * 60 * 1000
  return {
    proximaEtapa: proxima,
    status: 'pendente',
    bloqueado: false,
    prazoEtapaAtual: new Date(agora.getTime() + slaMs),
  }
}

/**
 * Calcula prazo inicial da etapa 1 ao criar uma Aprovacao.
 */
export function calcularPrazoInicial(slaHoras: number, agora = new Date()): Date {
  const ms = (slaHoras || 48) * 60 * 60 * 1000
  return new Date(agora.getTime() + ms)
}

/**
 * Verifica se um aprovador (com role x) pode decidir uma etapa.
 * Hierarquia: owner > admin > gerente > member > viewer.
 */
const ROLE_RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  gerente: 2,
  member: 1,
  viewer: 0,
}

export function podeAprovarEtapa(
  etapa: AprovacaoEtapa,
  aprovadorRole: string
): boolean {
  const need = ROLE_RANK[etapa.role] ?? 99
  const have = ROLE_RANK[aprovadorRole] ?? -1
  return have >= need
}
