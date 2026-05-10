/**
 * SPED ECF — Escrituração Contábil Fiscal (anual).
 *
 * Blocos mínimos implementados:
 *  - 0000 (abertura)
 *  - 0010 (parâmetros de tributação)
 *  - 0020 (parâmetros complementares)
 *  - N500 (DRE)
 *  - N620 (apuração CSLL trimestral)
 *  - N630 (apuração IRPJ trimestral)
 *  - P150 (apuração lucro real trimestral)
 *  - Y570 (atividades incentivadas)
 *  - 9999
 *
 * Layout TXT pipe-delimited CRLF. Validar contra PVA ECF da RFB.
 */

import { EOL, reg, spedDate, spedStr, spedMoney, hashArquivo } from './util'

export interface DREECF {
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custos: number
  lucroBruto: number
  despesasOperacionais: number
  resultadoOperacional: number
  outrasReceitas: number
  outrasDespesas: number
  lucroAntesIR: number
  irpj: number
  csll: number
  lucroLiquido: number
}

export interface ApuracaoTrimestral {
  /** 1, 2, 3 ou 4. */
  trimestre: 1 | 2 | 3 | 4
  baseCalculoIRPJ: number
  irpjDevido: number
  irpjAdicional: number
  baseCalculoCSLL: number
  csllDevido: number
}

export interface AtividadeIncentivada {
  codigo: string
  descricao: string
  valorReceita: number
}

export interface GerarECFInput {
  workspaceId: string
  anoFiscal: number
  empresa: {
    razaoSocial: string
    cnpj: string
    uf: string
    inscricaoEstadual?: string | null
    codigoMunicipioIBGE?: string | null
  }
  /** Forma de tributação: 1=Lucro Real Trimestral, 2=LR Anual, 3=Lucro Presumido, 4=Imune/Isenta, 5=Simples. */
  formaTributacao: '1' | '2' | '3' | '4' | '5'
  dadosDRE: DREECF
  apuracoesTrimestrais?: ApuracaoTrimestral[]
  atividadesIncentivadas?: AtividadeIncentivada[]
}

export interface GerarECFOutput {
  conteudo: string
  totalRegistros: number
  hash: string
  totaisPorRegistro: Record<string, number>
}

export async function gerarECF(input: GerarECFInput): Promise<GerarECFOutput> {
  const {
    anoFiscal,
    empresa,
    formaTributacao,
    dadosDRE,
    apuracoesTrimestrais = [],
    atividadesIncentivadas = [],
  } = input

  const ini = new Date(anoFiscal, 0, 1)
  const fim = new Date(anoFiscal, 11, 31, 23, 59, 59)

  const totals: Record<string, number> = {}
  const linhas: string[] = []
  const push = (registro: string, ...campos: (string | number | null | undefined)[]) => {
    linhas.push(reg(registro, ...campos))
    totals[registro] = (totals[registro] || 0) + 1
  }

  // 0000
  push(
    '0000',
    'LECF',
    '0', // tipo escrituração (0=original)
    '0', // situação especial
    '', // patrimônio (omitido)
    spedDate(ini),
    spedDate(fim),
    spedStr(empresa.razaoSocial, 100),
    empresa.cnpj.replace(/\D/g, ''),
    empresa.uf,
    empresa.inscricaoEstadual ?? '',
    empresa.codigoMunicipioIBGE ?? '',
    '0', // indicador SCP
    '', // hash ECD relacionada
    '0', // tipo declaração
  )

  // 0010 — parâmetros tributação
  push(
    '0010',
    formaTributacao, // forma tributação
    '0', // forma apuração (0=anual, 1=trimestral)
    '0', // qualifica PJ (0=demais)
    'N', // optante Refis
    'N', // optante PAES
    'N', // PJ habilitada lei do bem
    'N', // tributação em bases universais
    'N', // aplicação inc fiscais
    'N', // PJ submetida RTT
    'N', // forma escrituração diferenciada
    'N', // moeda funcional diferente
  )

  // 0020 — parâmetros complementares
  push(
    '0020',
    'N', // mudança forma tributação
    'N', // PJ cooperativa
    'N', // PJ qualificada PAA
    'N', // PJ qualificada PRT
    'N', // PJ rural
    'N', // imune isenta
    'N', // optante PERT
  )

  // N500 — DRE
  push('N500', 'RECEITA_BRUTA', spedMoney(dadosDRE.receitaBruta))
  push('N500', 'DEDUCOES', spedMoney(dadosDRE.deducoes))
  push('N500', 'RECEITA_LIQUIDA', spedMoney(dadosDRE.receitaLiquida))
  push('N500', 'CUSTOS', spedMoney(dadosDRE.custos))
  push('N500', 'LUCRO_BRUTO', spedMoney(dadosDRE.lucroBruto))
  push('N500', 'DESP_OPERACIONAIS', spedMoney(dadosDRE.despesasOperacionais))
  push('N500', 'RESULT_OPERACIONAL', spedMoney(dadosDRE.resultadoOperacional))
  push('N500', 'OUTRAS_REC', spedMoney(dadosDRE.outrasReceitas))
  push('N500', 'OUTRAS_DESP', spedMoney(dadosDRE.outrasDespesas))
  push('N500', 'LUCRO_ANTES_IR', spedMoney(dadosDRE.lucroAntesIR))
  push('N500', 'IRPJ', spedMoney(dadosDRE.irpj))
  push('N500', 'CSLL', spedMoney(dadosDRE.csll))
  push('N500', 'LUCRO_LIQUIDO', spedMoney(dadosDRE.lucroLiquido))

  // N620 (CSLL) + N630 (IRPJ) por trimestre
  for (const ap of apuracoesTrimestrais) {
    push(
      'N620',
      String(ap.trimestre),
      spedMoney(ap.baseCalculoCSLL),
      spedMoney(ap.csllDevido),
    )
    push(
      'N630',
      String(ap.trimestre),
      spedMoney(ap.baseCalculoIRPJ),
      spedMoney(ap.irpjDevido),
      spedMoney(ap.irpjAdicional),
    )
    // P150 — apuração lucro real trimestral (simplificado)
    push(
      'P150',
      String(ap.trimestre),
      spedMoney(ap.baseCalculoIRPJ),
      spedMoney(ap.irpjDevido + ap.irpjAdicional),
      spedMoney(ap.csllDevido),
    )
  }

  // Y570 — atividades incentivadas
  for (const a of atividadesIncentivadas) {
    push('Y570', a.codigo, spedStr(a.descricao, 100), spedMoney(a.valorReceita))
  }

  push('9999', String(linhas.length + 1))

  const conteudo = linhas.join('')
  const hash = await hashArquivo(conteudo)

  return {
    conteudo,
    totalRegistros: linhas.length,
    hash,
    totaisPorRegistro: totals,
  }
}
