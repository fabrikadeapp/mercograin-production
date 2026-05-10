/**
 * CNAB 400 retorno — layout FEBRABAN (cobrança CNAB400).
 *
 * Cada linha tem 400 colunas. Tipo registro na col 1 (0-indexed = pos 0):
 *   - '0': header arquivo
 *   - '1': detalhe (registro de título)
 *   - '9': trailer
 *
 * Posições padrão CNAB400 (Bradesco/Itaú/Santander/BB/CEF — variam levemente
 * por banco, mas as faixas críticas abaixo são compatíveis o suficiente para
 * conciliação):
 *   - 70-82:  nosso número (banco-específico, variando por banco)
 *   - 116-126: seu número (número documento da empresa)
 *   - 108-114: data vencimento DDMMAA
 *   - 152-165: valor título (13 dig)
 *   - 108-113 (alt CEF): data vencimento
 *   - 146-152: data crédito/pagamento
 *   - 253-266: valor pago
 *   - 108-110: código ocorrência
 *
 * NOTA: posições genéricas FEBRABAN — pequenas variações por banco são
 * absorvidas via parser tolerante (trim + parse vazio = null).
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

const TIPO = (line: string) => line[0] ?? ''

export function parseCnab400(content: string): CnabRetorno {
  const errors: string[] = []
  const linhasRaw = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (linhasRaw.length === 0) {
    return {
      header: { banco: '000', layout: '400' },
      detalhes: [],
      totalRegistros: 0,
      totalValorPago: 0,
      errors: ['Arquivo vazio'],
    }
  }
  const headerLine = linhasRaw[0]
  // Banco no header CNAB400: cols 76-79 (1-indexed) ⇒ slice(76,79)
  const banco = headerLine.slice(76, 79) || '000'
  if (!BANCOS_SUPORTADOS.includes(banco as any)) {
    errors.push(`Banco ${banco} não está na lista suportada`)
  }
  const header: CnabHeader = {
    banco,
    layout: '400',
    cedenteNome: headerLine.slice(46, 76).trim() || undefined,
    dataGeracao: parseCnabDate(headerLine.slice(94, 100)) || undefined,
  }

  const detalhes: CnabDetalhe[] = []
  let totalValorPago = 0

  for (let i = 0; i < linhasRaw.length; i++) {
    const line = linhasRaw[i]
    const numLinha = i + 1
    if (line.length < 400) {
      errors.push(`Linha ${numLinha}: tamanho ${line.length} < 400`)
      continue
    }
    if (TIPO(line) !== '1') continue

    const ocorrencia = line.slice(108, 110)
    const dataOcorrencia = parseCnabDate(line.slice(110, 116))
    const seuNumero = line.slice(116, 126).trim()
    const nossoNumero = line.slice(70, 82).trim() || line.slice(62, 70).trim()
    const dataVencimento = parseCnabDate(line.slice(146, 152))
    const valorTitulo = parseCnabValor(line.slice(152, 165))
    const valorPago = parseCnabValor(line.slice(253, 266))
    // Data pagamento (data crédito): 295-300 (DDMMAA)
    const dataPagamento = parseCnabDate(line.slice(295, 301)) || dataOcorrencia

    const ocPagamento = ['06', '17'].includes(ocorrencia)

    detalhes.push({
      nossoNumero,
      seuNumero,
      valorTitulo,
      valorPago: ocPagamento ? valorPago : 0,
      dataVencimento,
      dataPagamento: ocPagamento ? dataPagamento : null,
      ocorrenciaCodigo: ocorrencia,
      ocorrenciaDescricao: descricaoOcorrencia(ocorrencia),
      linha: numLinha,
    })
    if (ocPagamento) totalValorPago += valorPago
  }

  return {
    header,
    detalhes,
    totalRegistros: detalhes.length,
    totalValorPago: Math.round(totalValorPago * 100) / 100,
    errors,
  }
}
