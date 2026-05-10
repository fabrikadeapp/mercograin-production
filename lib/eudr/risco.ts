/**
 * S5 M9 — Avaliação de risco EUDR.
 *
 * Pura (sem IO): consome snapshot da propriedade e devolve nível + fatores.
 */

export type Gravidade = 'baixa' | 'media' | 'alta' | 'critica'
export type Nivel = 'baixo' | 'medio' | 'alto' | 'critico'

export type FatorTipo =
  | 'embargo_ibama'
  | 'sobreposicao_ti'
  | 'sobreposicao_uc'
  | 'desmatamento_recente'
  | 'car_invalido'
  | 'sem_geo'

export interface FatorRisco {
  tipo: FatorTipo
  descricao: string
  gravidade: Gravidade
}

export interface PropriedadeSnapshot {
  car?: string | null
  carStatus?: string | null
  embargoIbama?: boolean
  sobreposicaoTI?: boolean
  sobreposicaoUC?: boolean
  geoJson?: any
  alertaDesmatamento?: any[] | null
}

export interface AvaliarRiscoInput {
  propriedade: PropriedadeSnapshot
}

export interface AvaliarRiscoResultado {
  nivel: Nivel
  fatores: FatorRisco[]
}

export function avaliarRisco(input: AvaliarRiscoInput): AvaliarRiscoResultado {
  const p = input.propriedade
  const fatores: FatorRisco[] = []

  if (p.embargoIbama) {
    fatores.push({
      tipo: 'embargo_ibama',
      descricao: 'Propriedade em área embargada pelo IBAMA',
      gravidade: 'critica',
    })
  }
  if (p.sobreposicaoTI) {
    fatores.push({
      tipo: 'sobreposicao_ti',
      descricao: 'Sobreposição com Terra Indígena (FUNAI)',
      gravidade: 'critica',
    })
  }
  if (p.sobreposicaoUC) {
    fatores.push({
      tipo: 'sobreposicao_uc',
      descricao: 'Sobreposição com Unidade de Conservação (ICMBio)',
      gravidade: 'alta',
    })
  }
  if (p.carStatus === 'cancelado' || p.carStatus === 'invalido') {
    fatores.push({
      tipo: 'car_invalido',
      descricao: `CAR ${p.carStatus} — bloqueio EUDR`,
      gravidade: 'alta',
    })
  }
  if (!p.geoJson) {
    fatores.push({
      tipo: 'sem_geo',
      descricao: 'Sem georreferenciamento — bloqueio EUDR (Art. 9)',
      gravidade: 'alta',
    })
  }
  if (Array.isArray(p.alertaDesmatamento) && p.alertaDesmatamento.length > 0) {
    fatores.push({
      tipo: 'desmatamento_recente',
      descricao: `${p.alertaDesmatamento.length} alerta(s) de desmatamento desde 31/12/2020`,
      gravidade: 'alta',
    })
  }

  const tem = (g: Gravidade) => fatores.some((f) => f.gravidade === g)
  const nivel: Nivel = tem('critica') ? 'critico' : tem('alta') ? 'alto' : tem('media') ? 'medio' : 'baixo'

  return { nivel, fatores }
}

/**
 * Agrega risco de várias propriedades — o pior nível domina.
 */
export function agregarRisco(items: AvaliarRiscoResultado[]): AvaliarRiscoResultado {
  if (items.length === 0) return { nivel: 'baixo', fatores: [] }
  const ranking: Nivel[] = ['baixo', 'medio', 'alto', 'critico']
  let max: Nivel = 'baixo'
  const fatores: FatorRisco[] = []
  for (const r of items) {
    if (ranking.indexOf(r.nivel) > ranking.indexOf(max)) max = r.nivel
    fatores.push(...r.fatores)
  }
  return { nivel: max, fatores }
}
