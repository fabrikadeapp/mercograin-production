/**
 * Gerador SPED Fiscal (EFD-ICMS/IPI) — layout 2024.
 *
 * IMPLEMENTAÇÃO MÍNIMA VIÁVEL (MVP):
 *  - Bloco 0: 0000, 0001, 0005, 0100, 0990
 *  - Bloco C: C001, C100 (cabeçalho NF-e), C170 (itens), C990
 *  - Bloco 9: 9001, 9900 (por registro), 9990, 9999
 *
 * NÃO IMPLEMENTADO (estrutura preparada p/ adicionar):
 *  - Bloco B (serviços ISSQN — não típico p/ corretora grãos)
 *  - Bloco D (transporte — relevante p/ romaneios futuros)
 *  - Bloco E (apuração ICMS/IPI — depende contabilidade)
 *  - Bloco G (CIAP — bens do ativo imobilizado)
 *  - Bloco H (inventário — apenas no SPED de fevereiro)
 *  - Bloco K (controle produção/estoque — relevante p/ indústria)
 *  - Bloco 1 (registros complementares)
 *
 * IMPORTANTE: validar o arquivo gerado contra o Programa Validador SPED Fiscal
 * (PVA) antes de transmitir ao Fisco. Layout muda anualmente.
 */

import type { ConfiguracaoFiscal, NotaFiscal } from '@prisma/client'
import { EOL, reg, spedDate, spedStr, spedMoney, spedQtd, periodoMes, hashArquivo } from './util'

export interface SpedFiscalInput {
  config: ConfiguracaoFiscal
  competencia: string // YYYYMM
  empresa: {
    razaoSocial: string
    cnpj: string
    uf: string
    inscricaoEstadual?: string | null
    cidade?: string | null
    codigoMunicipioIBGE?: string | null
  }
  notas: (NotaFiscal & { itens: any })[]
}

export interface SpedFiscalOutput {
  conteudo: string
  totalRegistros: number
  hash: string
  totaisPorRegistro: Record<string, number>
}

export async function gerarSpedFiscal(input: SpedFiscalInput): Promise<SpedFiscalOutput> {
  const { config, competencia, empresa, notas } = input
  const { ini, fim } = periodoMes(competencia)

  const totalsByReg: Record<string, number> = {}
  const linhas: string[] = []
  function pushReg(registro: string, ...campos: (string | number | null | undefined)[]) {
    linhas.push(reg(registro, ...campos))
    totalsByReg[registro] = (totalsByReg[registro] || 0) + 1
  }

  // ===== BLOCO 0 =====
  // 0000: cabeçalho
  pushReg(
    '0000',
    '018', // versão layout (2024 = 018)
    '0', // tipo escrituração (0=original)
    '0', // perfil (A/B/C → 0=A na escrituração compactada)
    spedDate(ini),
    spedDate(fim),
    spedStr(empresa.razaoSocial, 100),
    empresa.cnpj.replace(/\D/g, ''),
    '', // CPF (vazio quando CNPJ)
    empresa.uf,
    empresa.inscricaoEstadual ?? '',
    empresa.codigoMunicipioIBGE ?? '',
    '', // IM
    '', // SUFRAMA
    '1', // indicador atividade (0=industrial, 1=outros)
  )

  // 0001: abertura bloco 0
  pushReg('0001', '0')

  // 0005: dados complementares
  pushReg(
    '0005',
    spedStr(empresa.razaoSocial, 100),
    '', // CEP
    '', // endereço
    '', // número
    '', // complemento
    '', // bairro
    '', // fone
    '', // fax
    '' // email
  )

  // 0100: contabilista (mínimo — corretora deve preencher)
  pushReg('0100', 'CONTADOR NAO INFORMADO', '00000000000', '000000', '', '', '', '', '', '', '', '', '')

  // 0150: cadastros de participantes (destinatários únicos)
  const participantes = new Map<string, NotaFiscal>()
  for (const n of notas) {
    const doc = n.destinatarioDoc.replace(/\D/g, '')
    if (!participantes.has(doc)) participantes.set(doc, n)
  }
  for (const [doc, n] of participantes) {
    pushReg(
      '0150',
      doc, // código participante = doc
      spedStr(n.destinatarioNome, 100),
      '1058', // país BR
      doc.length === 14 ? doc : '',
      doc.length === 11 ? doc : '',
      n.destinatarioIE ?? '',
      '', // município (IBGE)
      '', // SUFRAMA
      '', // endereço
      '', // número
      '', // complemento
      '' // bairro
    )
  }

  // 0190: unidade de medida
  const unidades = new Set<string>()
  for (const n of notas) {
    const itens: any[] = Array.isArray(n.itens) ? (n.itens as any[]) : []
    for (const it of itens) if (it?.unidade) unidades.add(String(it.unidade))
  }
  for (const u of unidades) {
    pushReg('0190', u, u)
  }

  // 0200: cadastro de itens
  const itensCatalog = new Map<string, { descricao: string; ncm: string; unidade: string }>()
  for (const n of notas) {
    const itens: any[] = Array.isArray(n.itens) ? (n.itens as any[]) : []
    for (const it of itens) {
      const cod = it.codigo || it.ncm || it.descricao?.slice(0, 30)
      if (cod && !itensCatalog.has(cod)) {
        itensCatalog.set(cod, {
          descricao: it.descricao ?? cod,
          ncm: it.ncm ?? '',
          unidade: it.unidade ?? 'UN',
        })
      }
    }
  }
  for (const [cod, info] of itensCatalog) {
    pushReg(
      '0200',
      spedStr(cod, 60),
      spedStr(info.descricao, 100),
      '', // codBarras
      '', // codAnt
      info.unidade,
      '00', // tipo (00=mercadoria revenda)
      info.ncm,
      '', // EX_IPI
      '', // gênero
      '', // CEST
      '', // alíq IPI
      '' // ALIQ_ICMS
    )
  }

  // 0990: fim bloco 0
  const qtd0 = countBloco(totalsByReg, '0')
  pushReg('0990', qtd0 + 1) // +1 contando o próprio 0990

  // ===== BLOCO C — Notas Fiscais (modelo 55) =====
  pushReg('C001', notas.length === 0 ? '1' : '0')

  for (const n of notas) {
    // C100: cabeçalho NF-e
    pushReg(
      'C100',
      n.tipo === 'entrada' ? '0' : '1', // 0=entrada, 1=saída
      '1', // emitente próprio
      n.destinatarioDoc.replace(/\D/g, ''),
      '55',
      n.status === 'cancelada' ? '02' : '00', // 00=regular, 02=cancelada
      String(n.serie),
      String(n.numero),
      n.chave ?? '',
      spedDate(n.dataEmissao),
      n.dataAutorizacao ? spedDate(n.dataAutorizacao) : spedDate(n.dataEmissao),
      spedMoney(n.valorTotal),
      '0', // indicador pagamento (0=à vista)
      '', // VL_DESC
      '', // VL_ABAT_NT
      spedMoney(n.valorProdutos),
      '1', // IND_FRT
      spedMoney(n.valorFrete),
      '0', // VL_SEG
      spedMoney(n.valorOutros),
      spedMoney(n.valorProdutos), // BC_ICMS
      spedMoney(n.valorICMS),
      '0', // BC_ICMS_ST
      '0', // ICMS_ST
      '0', // IPI
      spedMoney(n.valorPIS),
      spedMoney(n.valorCOFINS),
      '0',
      '0'
    )

    // C170: itens (apenas se status != cancelada)
    if (n.status !== 'cancelada' && Array.isArray(n.itens)) {
      const itens = n.itens as any[]
      itens.forEach((it, idx) => {
        pushReg(
          'C170',
          String(idx + 1),
          spedStr(it.codigo || it.ncm || it.descricao?.slice(0, 30) || `ITEM${idx}`, 60),
          spedStr(it.descricao ?? '', 100),
          spedQtd(it.qtd ?? 0),
          spedStr(it.unidade ?? 'UN', 6),
          spedMoney(it.valorTotal ?? 0),
          '', // VL_DESC
          n.tipo === 'entrada' ? '0' : '1', // movimentação física
          '000', // CST_ICMS (genérico — provider real ajusta)
          it.cfop ?? n.cfopPrincipal,
          '', // COD_NAT
          spedMoney(it.valorTotal ?? 0),
          spedMoney((it.valorTotal ?? 0) * (it.aliquotaICMS ?? 0) / 100),
          '', // ALIQ_ICMS
          '', // VL_ICMS
          '', // BC_ICMS_ST
          '', // ALIQ_ST
          '', // VL_ICMS_ST
          '', // IND_APUR
          '', // CST_IPI
          '', // COD_ENQ
          '', // BC_IPI
          '', // ALIQ_IPI
          '', // VL_IPI
          '', // CST_PIS
          '', // BC_PIS
          '', // ALIQ_PIS
          '', // QTD_BC_PIS
          '', // ALIQ_PIS_QTD
          spedMoney(it.valorPIS ?? 0),
          '', // CST_COFINS
          '', // BC_COFINS
          '', // ALIQ_COFINS
          '', // QTD_BC_COFINS
          '', // ALIQ_COFINS_QTD
          spedMoney(it.valorCOFINS ?? 0),
          '' // COD_CTA
        )
      })
    }
  }

  // C990: fim bloco C
  const qtdC = countBloco(totalsByReg, 'C')
  pushReg('C990', qtdC + 1)

  // ===== BLOCO 9 — controle/encerramento =====
  pushReg('9001', '0')

  // 9900: para cada registro distinto, qtd
  // Adicionar contagem futura — precisa incluir o próprio 9900 e os do bloco 9
  const tipos = [...Object.keys(totalsByReg)].sort()
  // 9900 + 9990 + 9999 serão incluídos depois — adicionar contagem aproximada agora:
  const linha9900Registros = tipos.length + 3 // +9900, +9990, +9999
  for (const t of tipos) {
    pushReg('9900', t, totalsByReg[t])
  }
  // 9900 do próprio 9900
  pushReg('9900', '9900', linha9900Registros)
  // 9990 e 9999
  pushReg('9900', '9990', 1)
  pushReg('9900', '9999', 1)

  // 9990: fim bloco 9 (qtd registros bloco 9)
  const qtd9 = countBloco(totalsByReg, '9')
  pushReg('9990', qtd9 + 1)

  // 9999: total geral (conta TUDO incluindo o próprio 9999)
  const totalReg = linhas.length + 1
  pushReg('9999', totalReg)

  const conteudo = linhas.join('')
  const hash = await hashArquivo(conteudo)

  return {
    conteudo,
    totalRegistros: linhas.length,
    hash,
    totaisPorRegistro: totalsByReg,
  }
}

function countBloco(totals: Record<string, number>, prefix: string): number {
  let n = 0
  for (const [k, v] of Object.entries(totals)) {
    if (k.startsWith(prefix)) n += v
  }
  return n
}
