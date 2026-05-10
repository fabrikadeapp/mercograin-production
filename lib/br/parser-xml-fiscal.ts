/**
 * Parser de XMLs fiscais brasileiros: NF-e (55/65), CT-e (57) e MDF-e (58).
 *
 * Não usa xml2js para evitar dependência extra — implementação por regex
 * sobre a estrutura conhecida do XML SEFAZ. Cobre os campos necessários
 * para conferência (chave, totais, emitente, destinatário, itens).
 *
 * IMPORTANTE: este parser foca em XMLs já válidos (assinados/protocolados).
 * Não substitui validação de schema XSD — usar apenas para conferência
 * interna após download do XML autorizado.
 */

import { isValidChaveNFe } from './chave-nfe'
import { isValidChaveCTe } from './chave-cte'
import { isValidChaveMDFe } from './chave-mdfe'

// ============================================================
// helpers
// ============================================================

/** Extrai conteúdo da PRIMEIRA ocorrência de <tag ...>...</tag>. */
function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

/** Extrai todas as ocorrências de <tag ...>...</tag>. */
function tagAll(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim())
  return out
}

/** Extrai chave de Id="...XXXX44dig"; aceita qualquer prefixo. */
function chaveFromInfElement(xml: string, infTag: string): string | null {
  const re = new RegExp(`<${infTag}[^>]*Id="[A-Za-z]*(\\d{44})"`, 'i')
  const m = xml.match(re)
  return m ? m[1] : null
}

function toNum(s: string | null): number {
  if (!s) return 0
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function toDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ============================================================
// NF-e (modelo 55 / 65)
// ============================================================

export interface NFeXmlItem {
  descricao: string
  ncm: string
  cfop: string
  qtd: number
  unidade: string
  valorUnitario: number
  valorTotal: number
}

export interface NFeXmlData {
  chave: string
  numero: string
  serie: string
  modelo: string
  emitenteCnpj: string
  emitenteNome: string
  destinatarioDoc: string
  destinatarioNome: string
  valor: number
  dataEmissao: Date | null
  itens: NFeXmlItem[]
}

export function parseNFeXml(xml: string): NFeXmlData | null {
  if (!xml || typeof xml !== 'string') return null

  const chave = chaveFromInfElement(xml, 'infNFe')
  if (!chave || !isValidChaveNFe(chave)) return null

  const ide = tag(xml, 'ide') || ''
  const emit = tag(xml, 'emit') || ''
  const dest = tag(xml, 'dest') || ''
  const total = tag(xml, 'ICMSTot') || tag(xml, 'total') || ''

  const itens: NFeXmlItem[] = tagAll(xml, 'det').map((det) => {
    const prod = tag(det, 'prod') || ''
    return {
      descricao: tag(prod, 'xProd') || '',
      ncm: tag(prod, 'NCM') || '',
      cfop: tag(prod, 'CFOP') || '',
      qtd: toNum(tag(prod, 'qCom')),
      unidade: tag(prod, 'uCom') || 'UN',
      valorUnitario: toNum(tag(prod, 'vUnCom')),
      valorTotal: toNum(tag(prod, 'vProd')),
    }
  })

  return {
    chave,
    numero: tag(ide, 'nNF') || '',
    serie: tag(ide, 'serie') || '',
    modelo: tag(ide, 'mod') || chave.slice(20, 22),
    emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF') || '',
    emitenteNome: tag(emit, 'xNome') || '',
    destinatarioDoc: tag(dest, 'CNPJ') || tag(dest, 'CPF') || '',
    destinatarioNome: tag(dest, 'xNome') || '',
    valor: toNum(tag(total, 'vNF')) || toNum(tag(total, 'vProd')),
    dataEmissao: toDate(tag(ide, 'dhEmi') || tag(ide, 'dEmi')),
    itens,
  }
}

// ============================================================
// CT-e (modelo 57)
// ============================================================

export interface CTeXmlData {
  chave: string
  numero: string
  serie: string
  modelo: string
  emitenteCnpj: string
  emitenteNome: string
  remetenteDoc: string
  destinatarioDoc: string
  valorTotal: number
  valorCarga: number
  dataEmissao: Date | null
  origemUF: string
  destinoUF: string
  observacoes: string
}

export function parseCTeXml(xml: string): CTeXmlData | null {
  if (!xml || typeof xml !== 'string') return null

  const chave = chaveFromInfElement(xml, 'infCte') || chaveFromInfElement(xml, 'infCTe')
  if (!chave || !isValidChaveCTe(chave)) return null

  const ide = tag(xml, 'ide') || ''
  const emit = tag(xml, 'emit') || ''
  const rem = tag(xml, 'rem') || ''
  const dest = tag(xml, 'dest') || ''
  const vPrest = tag(xml, 'vPrest') || ''
  const infCarga = tag(xml, 'infCarga') || ''

  return {
    chave,
    numero: tag(ide, 'nCT') || '',
    serie: tag(ide, 'serie') || '',
    modelo: tag(ide, 'mod') || '57',
    emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF') || '',
    emitenteNome: tag(emit, 'xNome') || '',
    remetenteDoc: tag(rem, 'CNPJ') || tag(rem, 'CPF') || '',
    destinatarioDoc: tag(dest, 'CNPJ') || tag(dest, 'CPF') || '',
    valorTotal: toNum(tag(vPrest, 'vTPrest')),
    valorCarga: toNum(tag(infCarga, 'vCarga')),
    dataEmissao: toDate(tag(ide, 'dhEmi')),
    origemUF: tag(ide, 'UFIni') || '',
    destinoUF: tag(ide, 'UFFim') || '',
    observacoes: tag(xml, 'xObs') || '',
  }
}

// ============================================================
// MDF-e (modelo 58)
// ============================================================

export interface MDFeXmlData {
  chave: string
  numero: string
  serie: string
  modelo: string
  emitenteCnpj: string
  emitenteNome: string
  ufIni: string
  ufFim: string
  qtdCTe: number
  qtdNFe: number
  valorCarga: number
  pesoBrutoKg: number
  dataEmissao: Date | null
  placaVeic: string
}

export function parseMDFeXml(xml: string): MDFeXmlData | null {
  if (!xml || typeof xml !== 'string') return null

  const chave = chaveFromInfElement(xml, 'infMDFe')
  if (!chave || !isValidChaveMDFe(chave)) return null

  const ide = tag(xml, 'ide') || ''
  const emit = tag(xml, 'emit') || ''
  const tot = tag(xml, 'tot') || ''
  const veicTracao = tag(xml, 'veicTracao') || ''

  return {
    chave,
    numero: tag(ide, 'nMDF') || '',
    serie: tag(ide, 'serie') || '',
    modelo: tag(ide, 'mod') || '58',
    emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF') || '',
    emitenteNome: tag(emit, 'xNome') || '',
    ufIni: tag(ide, 'UFIni') || '',
    ufFim: tag(ide, 'UFFim') || '',
    qtdCTe: parseInt(tag(tot, 'qCTe') || '0', 10),
    qtdNFe: parseInt(tag(tot, 'qNFe') || '0', 10),
    valorCarga: toNum(tag(tot, 'vCarga')),
    pesoBrutoKg: toNum(tag(tot, 'qCarga')) * 1000, // qCarga vem em toneladas
    dataEmissao: toDate(tag(ide, 'dhEmi')),
    placaVeic: tag(veicTracao, 'placa') || '',
  }
}

// ============================================================
// Detecção automática
// ============================================================

export type XmlFiscalKind = 'nfe' | 'cte' | 'mdfe' | 'unknown'

export function detectXmlKind(xml: string): XmlFiscalKind {
  if (!xml) return 'unknown'
  if (/<infMDFe[\s>]/i.test(xml)) return 'mdfe'
  if (/<infCte[\s>]|<infCTe[\s>]/i.test(xml)) return 'cte'
  if (/<infNFe[\s>]/i.test(xml)) return 'nfe'
  return 'unknown'
}
