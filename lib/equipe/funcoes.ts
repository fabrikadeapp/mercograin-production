/**
 * Funções (cargos semânticos) de colaboradores no workspace.
 *
 * Enum fixo controlado pelo sistema. Uma pessoa pode ter várias.
 * Define visibilidade fina + agrupamento BI dentro de cada área.
 *
 * - trader, gerente_conta, cs           → atuam na Mesa
 * - gerente_mesa                        → supervisor da Mesa (vê tudo)
 * - analista_financeiro                 → Financeiro operacional
 * - gerente_administrativo, cfo         → Financeiro / executivo
 * - analista_fiscal, gerente_fiscal     → Fiscal
 * - assistente, compliance, ti          → suporte transversal
 */

export const FUNCOES = [
  'trader',
  'gerente_mesa',
  'gerente_conta',
  'cs',
  'analista_financeiro',
  'gerente_administrativo',
  'cfo',
  'analista_fiscal',
  'gerente_fiscal',
  'assistente',
  'compliance',
  'ti',
] as const

export type Funcao = (typeof FUNCOES)[number]

export const FUNCAO_LABEL: Record<Funcao, string> = {
  trader: 'Trader',
  gerente_mesa: 'Gerente de Mesa',
  gerente_conta: 'Gerente de Conta',
  cs: 'Customer Success',
  analista_financeiro: 'Analista Financeiro',
  gerente_administrativo: 'Gerente Administrativo',
  cfo: 'CFO',
  analista_fiscal: 'Analista Fiscal',
  gerente_fiscal: 'Gerente Fiscal',
  assistente: 'Assistente',
  compliance: 'Compliance',
  ti: 'TI',
}

export const FUNCAO_AREA_SUGERIDA: Record<Funcao, string[]> = {
  trader: ['mesa'],
  gerente_mesa: ['mesa'],
  gerente_conta: ['mesa'],
  cs: ['mesa'],
  analista_financeiro: ['financeiro'],
  gerente_administrativo: ['financeiro'],
  cfo: ['financeiro', 'gestao'],
  analista_fiscal: ['fiscal'],
  gerente_fiscal: ['fiscal'],
  assistente: ['mesa'],
  compliance: ['fiscal'],
  ti: ['gestao'],
}

/** True se função inclui supervisão (vê tudo na área dela). */
export function isGerente(funcao: Funcao): boolean {
  return (
    funcao === 'gerente_mesa' ||
    funcao === 'gerente_administrativo' ||
    funcao === 'cfo' ||
    funcao === 'gerente_fiscal'
  )
}

/** True se qualquer função da lista é supervisora. */
export function temFuncaoGerente(funcoes: string[] | null | undefined): boolean {
  if (!funcoes || funcoes.length === 0) return false
  return funcoes.some((f) => isGerente(f as Funcao))
}

/** True se o membro deve ter visão completa da Mesa (todos os clientes/propostas). */
export function temVisaoCompletaMesa(
  workspaceRole: string | null | undefined,
  funcoes: string[] | null | undefined,
): boolean {
  if (workspaceRole === 'owner' || workspaceRole === 'admin') return true
  if (!funcoes) return false
  return funcoes.includes('gerente_mesa') || funcoes.includes('cfo')
}
