/**
 * CNAB 240 retorno — layout FEBRABAN.
 *
 * Estrutura por linha (240 colunas):
 *   - tipo registro (col 8): 0=header arquivo, 1=header lote, 3=detalhe,
 *     5=trailer lote, 9=trailer arquivo.
 *   - segmento (col 14, apenas em detalhes): T (dados título), U (valores).
 *
 * Posições (0-indexed, slice fim exclusivo) — Segmento T:
 *   - 17-37: nosso número (banco-específico)
 *   - 58-73: número do documento (seu número)
 *   - 73-81: data vencimento DDMMAAAA
 *   - 81-96: valor título (13 dígitos + 2 centavos)
 *   - 15-17: código ocorrência
 *
 * Segmento U:
 *   - 17-32: valor pago (15 dígitos com 2 decimais)
 *   - 137-145: data efetivação (pagamento) DDMMAAAA
 *
 * Suporta: 001 (BB), 237 (Bradesco), 341 (Itaú), 033 (Santander), 104 (CEF).
 */
import {
  BANCOS_SUPORTADOS,
  CnabDetalhe,
  CnabHeader,
  CnabRetorno,
  descricaoOcorrencia,
  parseCnabDate,
  parseCnabValor,
} from './types'

const TIPO_REG = (line: string) => line[7] ?? ''
const SEGMENTO = (line: string) => line[13] ?? ''
const BANCO = (line: string) => line.slice(0, 3)

interface PendingT {
  nossoNumero: string
  seuNumero: string
  valorTitulo: number
  dataVencimento: string | null
  ocorrenciaCodigo: string
  ocorrenciaDescricao: string
  linha: number
}

export function parseCnab240(content: string): CnabRetorno {
  const errors: string[] = []
  const linhasRaw = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (linhasRaw.length === 0) {
    return {
      header: { banco: '000', layout: '240' },
      detalhes: [],
      totalRegistros: 0,
      totalValorPago: 0,
      errors: ['Arquivo vazio'],
    }
  }

  const headerLine = linhasRaw[0]
  const banco = BANCO(headerLine)
  if (!BANCOS_SUPORTADOS.includes(banco as any)) {
    errors.push(`Banco ${banco} não está na lista suportada`)
  }

  const header: CnabHeader = {
    banco,
    layout: '240',
    cedenteNome: headerLine.slice(72, 102).trim() || undefined,
    cedenteDocumento: headerLine.slice(18, 32).trim() || undefined,
    arquivoSeq: parseInt(headerLine.slice(157, 163), 10) || undefined,
    dataGeracao: parseCnabDate(headerLine.slice(143, 151)) || undefined,
  }

  const detalhes: CnabDetalhe[] = []
  let pendingT: PendingT | null = null
  let totalValorPago = 0

  for (let i = 0; i < linhasRaw.length; i++) {
    const line = linhasRaw[i]
    const numLinha = i + 1
    if (line.length < 240) {
      // Pad para evitar slice undefined; mas avisa.
      errors.push(`Linha ${numLinha}: tamanho ${line.length} < 240`)
      continue
    }
    if (TIPO_REG(line) !== '3') continue

    const seg = SEGMENTO(line)
    const ocorrencia = line.slice(15, 17)
    if (seg === 'T') {
      pendingT = {
        nossoNumero: line.slice(37, 57).trim(),
        seuNumero: line.slice(58, 73).trim(),
        dataVencimento: parseCnabDate(line.slice(73, 81)),
        valorTitulo: parseCnabValor(line.slice(81, 96)),
        ocorrenciaCodigo: ocorrencia,
        ocorrenciaDescricao: descricaoOcorrencia(ocorrencia),
        linha: numLinha,
      }
    } else if (seg === 'U') {
      const valorPago = parseCnabValor(line.slice(17, 32))
      const dataPagamento = parseCnabDate(line.slice(137, 145))
      const base = pendingT
      if (!base) {
        errors.push(`Linha ${numLinha}: segmento U sem T precedente`)
        continue
      }
      detalhes.push({
        nossoNumero: base.nossoNumero,
        seuNumero: base.seuNumero,
        valorTitulo: base.valorTitulo,
        valorPago,
        dataVencimento: base.dataVencimento,
        dataPagamento,
        ocorrenciaCodigo: base.ocorrenciaCodigo,
        ocorrenciaDescricao: base.ocorrenciaDescricao,
        linha: base.linha,
      })
      totalValorPago += valorPago
      pendingT = null
    }
  }

  if (pendingT) {
    // T sem U: registra mesmo assim com valorPago=0
    detalhes.push({
      nossoNumero: pendingT.nossoNumero,
      seuNumero: pendingT.seuNumero,
      valorTitulo: pendingT.valorTitulo,
      valorPago: 0,
      dataVencimento: pendingT.dataVencimento,
      dataPagamento: null,
      ocorrenciaCodigo: pendingT.ocorrenciaCodigo,
      ocorrenciaDescricao: pendingT.ocorrenciaDescricao,
      linha: pendingT.linha,
    })
  }

  return {
    header,
    detalhes,
    totalRegistros: detalhes.length,
    totalValorPago: Math.round(totalValorPago * 100) / 100,
    errors,
  }
}
