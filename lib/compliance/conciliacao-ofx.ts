/**
 * Parser OFX (Open Financial Exchange) — formatos 1.x (SGML) e 2.x (XML).
 * Idempotência via hash determinístico de (data, valor, FITID).
 */
import crypto from 'crypto'

export interface OFXTransacao {
  data: Date
  valor: number
  tipo: 'CREDIT' | 'DEBIT'
  descricao: string
  /** FITID — identificador único do banco para a transação */
  identificadorBanco: string
  /** Hash determinístico para idempotência */
  hash: string
}

export function gerarHashTransacao(t: {
  data: Date
  valor: number
  identificadorBanco: string
}): string {
  const key = `${t.data.toISOString().slice(0, 10)}|${t.valor.toFixed(2)}|${t.identificadorBanco}`
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Detecta se é OFX 2.x (XML) ou 1.x (SGML).
 */
function ehXml(conteudo: string): boolean {
  return /^<\?xml/i.test(conteudo.trim())
}

/**
 * Limpa marcadores SGML do OFX 1.x — converte tags não-fechadas em XML válido.
 */
function ofx1ParaXml(conteudo: string): string {
  // Remove header até <OFX>
  const idx = conteudo.indexOf('<OFX>')
  if (idx < 0) throw new Error('OFX 1.x sem tag <OFX>')
  let body = conteudo.slice(idx)

  // Auto-fecha tags simples (formato <TAG>valor sem </TAG>)
  body = body.replace(/<([A-Z0-9.]+)>([^<\r\n]+)/g, (_m, tag, val) => {
    return `<${tag}>${val.trim()}</${tag}>`
  })

  return body
}

/**
 * Parse data OFX (YYYYMMDD ou YYYYMMDDHHmmss[.xxx][TZ]).
 */
function parseOFXDate(s: string): Date {
  const clean = (s || '').trim().replace(/\[.*$/, '')
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/)
  if (!m) throw new Error(`Data OFX inválida: ${s}`)
  const [, y, mo, d, hh = '00', mm = '00', ss = '00'] = m
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    )
  )
}

/**
 * Extrai valor de uma tag dentro de um bloco STMTTRN.
 */
function extrair(bloco: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>\\s*([^<]*)\\s*</${tag}>`, 'i')
  const m = bloco.match(re)
  return m ? m[1].trim() : null
}

export function parseOFX(conteudo: string): OFXTransacao[] {
  const xml = ehXml(conteudo) ? conteudo : ofx1ParaXml(conteudo)

  // Encontra todos os blocos STMTTRN
  const trnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  const trans: OFXTransacao[] = []
  let m: RegExpExecArray | null
  while ((m = trnRe.exec(xml)) !== null) {
    const bloco = m[1]
    const dtRaw = extrair(bloco, 'DTPOSTED')
    const trnamtRaw = extrair(bloco, 'TRNAMT')
    const fitid = extrair(bloco, 'FITID')
    const trnTipo = (extrair(bloco, 'TRNTYPE') || '').toUpperCase()
    const memo = extrair(bloco, 'MEMO') || extrair(bloco, 'NAME') || ''

    if (!dtRaw || !trnamtRaw || !fitid) continue
    const valor = Number(trnamtRaw.replace(',', '.'))
    if (!Number.isFinite(valor)) continue
    const data = parseOFXDate(dtRaw)

    const tipo: 'CREDIT' | 'DEBIT' =
      trnTipo === 'CREDIT' ||
      trnTipo === 'DEP' ||
      (trnTipo === '' && valor > 0)
        ? 'CREDIT'
        : 'DEBIT'

    trans.push({
      data,
      valor,
      tipo,
      descricao: memo,
      identificadorBanco: fitid,
      hash: gerarHashTransacao({ data, valor, identificadorBanco: fitid }),
    })
  }
  return trans
}
