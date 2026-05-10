/**
 * SPED ECD — Escrituração Contábil Digital (anual).
 *
 * Blocos mínimos implementados:
 *  - 0000 (abertura + CNPJ + período)
 *  - 0007 (outras inscrições — opcional, gerado vazio se não houver)
 *  - I050 (plano de contas)
 *  - I150 (saldo periódico)
 *  - I250 (lançamentos contábeis)
 *  - J100 (balancete)
 *  - J150 (DRE)
 *  - 9999 (totalizador)
 *
 * Layout TXT pipe-delimited CRLF. Validar contra PVA ECD da RFB antes de
 * transmitir. Layout muda anualmente.
 */

import { EOL, reg, spedDate, spedStr, spedMoney, hashArquivo } from './util'

export interface PlanoContaItem {
  codigo: string
  /** Nível hierárquico (1 = sintética raiz, 9 = analítica máxima). */
  nivel: number
  /** S = sintética, A = analítica. */
  tipo: 'S' | 'A'
  /** Natureza: 1=ativo 2=passivo 3=PL 4=receita 5=custo/despesa 7=outras 8=compensação. */
  natureza: '1' | '2' | '3' | '4' | '5' | '7' | '8'
  descricao: string
}

export interface SaldoPeriodico {
  codigoConta: string
  saldoInicial: number
  saldoFinal: number
  /** D = devedor, C = credor. */
  natureza: 'D' | 'C'
}

export interface LancamentoContabil {
  numero: string
  data: Date
  contaDebito: string
  contaCredito: string
  valor: number
  historico: string
}

export interface BalanceteItem {
  codigoConta: string
  saldoFinal: number
  natureza: 'D' | 'C'
}

export interface DREItem {
  codigoConta: string
  descricao: string
  valor: number
  /** R = receita, D = despesa/custo. */
  tipo: 'R' | 'D'
}

export interface GerarECDInput {
  workspaceId: string
  anoFiscal: number
  empresa: {
    razaoSocial: string
    cnpj: string
    uf: string
    inscricaoEstadual?: string | null
    codigoMunicipioIBGE?: string | null
  }
  outrasInscricoes?: { uf: string; ie: string }[]
  planoContas: PlanoContaItem[]
  saldosPeriodicos?: SaldoPeriodico[]
  lancamentos: LancamentoContabil[]
  balancete?: BalanceteItem[]
  dre?: DREItem[]
}

export interface GerarECDOutput {
  conteudo: string
  totalRegistros: number
  hash: string
  totaisPorRegistro: Record<string, number>
}

export async function gerarECD(input: GerarECDInput): Promise<GerarECDOutput> {
  const {
    anoFiscal,
    empresa,
    outrasInscricoes = [],
    planoContas,
    saldosPeriodicos = [],
    lancamentos,
    balancete = [],
    dre = [],
  } = input

  const ini = new Date(anoFiscal, 0, 1)
  const fim = new Date(anoFiscal, 11, 31, 23, 59, 59)

  const totals: Record<string, number> = {}
  const linhas: string[] = []
  const push = (registro: string, ...campos: (string | number | null | undefined)[]) => {
    linhas.push(reg(registro, ...campos))
    totals[registro] = (totals[registro] || 0) + 1
  }

  // 0000 — abertura
  push(
    '0000',
    'LECD',
    spedDate(ini),
    spedDate(fim),
    spedStr(empresa.razaoSocial, 100),
    empresa.cnpj.replace(/\D/g, ''),
    empresa.uf,
    empresa.inscricaoEstadual ?? '',
    empresa.codigoMunicipioIBGE ?? '',
    '0', // indicador situação especial (0=normal)
    '', // identificação SCP
    '0', // forma escrituração (0=livro próprio)
    '0', // tipo ECD (0=original)
    '1', // identificação responsável (1=contador)
  )

  // 0007 — outras inscrições (1 por UF/IE adicional)
  for (const o of outrasInscricoes) {
    push('0007', o.uf, spedStr(o.ie, 20))
  }

  // I050 — plano de contas
  for (const p of planoContas) {
    push(
      'I050',
      spedDate(ini),
      String(p.natureza),
      p.tipo,
      String(p.nivel),
      p.codigo,
      '', // código conta sintética superior (omitido p/ MVP)
      '', // CTA referencial
      spedStr(p.descricao, 60),
    )
  }

  // I150 — saldo periódico (cabeçalho) + I155 normalmente; manter mínimo I150
  for (const s of saldosPeriodicos) {
    push(
      'I150',
      spedDate(ini),
      spedDate(fim),
    )
    push(
      'I155',
      s.codigoConta,
      '', // centro custo
      spedMoney(s.saldoInicial),
      s.natureza,
      spedMoney(s.saldoFinal),
      s.natureza,
      '0,00', // débitos
      '0,00', // créditos
    )
  }

  // I250 — lançamentos contábeis (cabeçalho I200 + partidas I250)
  for (const l of lancamentos) {
    push(
      'I200',
      l.numero,
      spedDate(l.data),
      spedMoney(l.valor),
      'N', // tipo lançamento (N=normal)
    )
    push(
      'I250',
      l.contaDebito,
      '', // centro custo
      spedMoney(l.valor),
      'D',
      spedStr(l.historico, 600),
      '', // código histórico padrão
      '', // entidade
    )
    push(
      'I250',
      l.contaCredito,
      '',
      spedMoney(l.valor),
      'C',
      spedStr(l.historico, 600),
      '',
      '',
    )
  }

  // J100 — balancete
  for (const b of balancete) {
    push(
      'J100',
      b.codigoConta,
      '', // nível
      '', // natureza
      '', // tipo (S/A)
      '', // descrição
      '0,00', // saldo inicial
      'D',
      spedMoney(b.saldoFinal),
      b.natureza,
    )
  }

  // J150 — DRE
  let ordem = 0
  for (const d of dre) {
    ordem++
    push(
      'J150',
      String(ordem),
      d.codigoConta,
      '', // nível
      spedStr(d.descricao, 60),
      d.tipo === 'R' ? '+' : '-',
      spedMoney(d.valor),
    )
  }

  // Totalizador
  let totalRegistros = linhas.length + 1 // + o próprio 9999
  push('9999', String(totalRegistros))

  const conteudo = linhas.join('')
  const hash = await hashArquivo(conteudo)

  return {
    conteudo,
    totalRegistros: linhas.length,
    hash,
    totaisPorRegistro: totals,
  }
}
