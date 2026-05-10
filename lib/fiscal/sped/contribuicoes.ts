/**
 * Gerador SPED Contribuições (EFD-Contribuições) — PIS/COFINS.
 *
 * MVP — blocos implementados:
 *  - 0000, 0001, 0100, 0140 (estabelecimento), 0990
 *  - A001/A990 (placeholder serviços — vazio p/ corretora típica)
 *  - C001, C100 (NF-e), C170 (itens PIS/COFINS), C990
 *  - M001/M990 (apuração — placeholder)
 *  - 9001, 9900, 9990, 9999
 *
 * NÃO IMPLEMENTADO:
 *  - F100 (demais documentos)
 *  - M200/M600 (consolidação apuração detalhada — depende contabilidade)
 *  - P (apuração da CPRB)
 *
 * Validar contra PVA EFD-Contribuições.
 */

import type { ConfiguracaoFiscal, NotaFiscal } from '@prisma/client'
import { EOL, reg, spedDate, spedStr, spedMoney, spedQtd, periodoMes, hashArquivo } from './util'

export interface SpedContribuicoesInput {
  config: ConfiguracaoFiscal
  competencia: string
  empresa: {
    razaoSocial: string
    cnpj: string
    uf: string
    inscricaoEstadual?: string | null
    codigoMunicipioIBGE?: string | null
  }
  notas: (NotaFiscal & { itens: any })[]
}

export interface SpedContribuicoesOutput {
  conteudo: string
  totalRegistros: number
  hash: string
}

export async function gerarSpedContribuicoes(
  input: SpedContribuicoesInput
): Promise<SpedContribuicoesOutput> {
  const { config, competencia, empresa, notas } = input
  const { ini, fim } = periodoMes(competencia)
  const linhas: string[] = []
  const totals: Record<string, number> = {}
  function p(registro: string, ...campos: (string | number | null | undefined)[]) {
    linhas.push(reg(registro, ...campos))
    totals[registro] = (totals[registro] || 0) + 1
  }

  // ===== BLOCO 0 =====
  p(
    '0000',
    '006', // versão layout
    '0', // tipo escrituração
    '', // ind situação especial
    '', // num receita
    spedDate(ini),
    spedDate(fim),
    spedStr(empresa.razaoSocial, 100),
    empresa.cnpj.replace(/\D/g, ''),
    empresa.uf,
    empresa.codigoMunicipioIBGE ?? '',
    '', // SUFRAMA
    '0', // IND_NAT_PJ (0=PJ direito privado)
    config.regimeTributario === 'lucro_real' ? '1' : '2', // 1=cumulativo, 2=não-cumulativo (simplificado)
    '1', // IND_ATIV (0=industrial, 1=outros)
    '' // IND_REG_CUM
  )

  p('0001', '0')

  // 0100: contabilista
  p('0100', 'CONTADOR NAO INFORMADO', '00000000000', '000000', '', '', '', '', '', '', '', '', '')

  // 0110: regime de apuração
  p('0110', '2', '1', '', '')

  // 0140: estabelecimentos
  p(
    '0140',
    '001',
    spedStr(empresa.razaoSocial, 100),
    empresa.cnpj.replace(/\D/g, ''),
    empresa.uf,
    empresa.inscricaoEstadual ?? '',
    empresa.codigoMunicipioIBGE ?? '',
    '',
    ''
  )

  // 0150: participantes únicos
  const part = new Map<string, NotaFiscal>()
  for (const n of notas) {
    const d = n.destinatarioDoc.replace(/\D/g, '')
    if (!part.has(d)) part.set(d, n)
  }
  for (const [doc, n] of part) {
    p(
      '0150',
      doc,
      spedStr(n.destinatarioNome, 100),
      '1058',
      doc.length === 14 ? doc : '',
      doc.length === 11 ? doc : '',
      '',
      '',
      '',
      '',
      '',
      ''
    )
  }

  // 0990
  const q0 = countByPrefix(totals, '0')
  p('0990', q0 + 1)

  // ===== BLOCO A (serviços) — vazio =====
  p('A001', '1')
  p('A990', 2)

  // ===== BLOCO C — documentos fiscais =====
  p('C001', notas.length === 0 ? '1' : '0')

  for (const n of notas) {
    p(
      'C100',
      n.tipo === 'entrada' ? '0' : '1',
      '1',
      n.destinatarioDoc.replace(/\D/g, ''),
      '55',
      n.status === 'cancelada' ? '02' : '00',
      String(n.serie),
      String(n.numero),
      n.chave ?? '',
      spedDate(n.dataEmissao),
      n.dataAutorizacao ? spedDate(n.dataAutorizacao) : spedDate(n.dataEmissao),
      spedMoney(n.valorTotal),
      '0',
      '',
      '',
      spedMoney(n.valorProdutos),
      '1',
      spedMoney(n.valorFrete),
      '0',
      spedMoney(n.valorOutros),
      spedMoney(n.valorPIS),
      spedMoney(n.valorCOFINS)
    )

    if (n.status !== 'cancelada' && Array.isArray(n.itens)) {
      const itens = n.itens as any[]
      itens.forEach((it, idx) => {
        p(
          'C170',
          String(idx + 1),
          spedStr(it.codigo || it.ncm || `ITEM${idx}`, 60),
          spedStr(it.descricao ?? '', 100),
          spedQtd(it.qtd ?? 0),
          spedStr(it.unidade ?? 'UN', 6),
          spedMoney(it.valorTotal ?? 0),
          '',
          n.tipo === 'entrada' ? '0' : '1',
          '000',
          it.cfop ?? n.cfopPrincipal,
          '',
          spedMoney(it.valorTotal ?? 0),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '01', // CST_PIS (01=operação tributável c/ alíquota básica)
          spedMoney(it.valorTotal ?? 0),
          '0,65',
          '',
          '',
          spedMoney(it.valorPIS ?? 0),
          '01', // CST_COFINS
          spedMoney(it.valorTotal ?? 0),
          '3,00',
          '',
          '',
          spedMoney(it.valorCOFINS ?? 0),
          ''
        )
      })
    }
  }

  const qC = countByPrefix(totals, 'C')
  p('C990', qC + 1)

  // ===== BLOCO M — apuração (placeholder) =====
  p('M001', '1')
  p('M990', 2)

  // ===== BLOCO 9 =====
  p('9001', '0')
  const tipos = [...Object.keys(totals)].sort()
  for (const t of tipos) {
    p('9900', t, totals[t])
  }
  p('9900', '9900', tipos.length + 3)
  p('9900', '9990', 1)
  p('9900', '9999', 1)
  const q9 = countByPrefix(totals, '9')
  p('9990', q9 + 1)
  p('9999', linhas.length + 1)

  const conteudo = linhas.join('')
  return {
    conteudo,
    totalRegistros: linhas.length,
    hash: await hashArquivo(conteudo),
  }
}

function countByPrefix(t: Record<string, number>, prefix: string): number {
  let n = 0
  for (const [k, v] of Object.entries(t)) if (k.startsWith(prefix)) n += v
  return n
}
