/**
 * Utilitários para gerar layout SPED (TXT pipe-delimited).
 * Formato: |REGISTRO|campo1|campo2|...|<EOL>
 * EOL: \r\n (CRLF) conforme manual SPED.
 */

export const EOL = '\r\n'

export function spedDate(d: Date): string {
  // ddmmaaaa
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}${mm}${yyyy}`
}

export function spedDateFromIso(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return spedDate(d)
}

export function spedMoney(n: number | string | { toString(): string } | null | undefined): string {
  if (n === null || n === undefined) return '0,00'
  const num = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(num)) return '0,00'
  return num.toFixed(2).replace('.', ',')
}

export function spedQtd(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '0,000'
  const num = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(num)) return '0,000'
  return num.toFixed(3).replace('.', ',')
}

/**
 * Monta linha SPED com pipes. Aceita undefined/null → vazio.
 */
export function reg(registro: string, ...campos: (string | number | null | undefined)[]): string {
  const partes = [registro, ...campos.map((c) => (c === undefined || c === null ? '' : String(c)))]
  return `|${partes.join('|')}|` + EOL
}

export function periodoMes(competencia: string): { ini: Date; fim: Date } {
  // YYYYMM
  const ano = parseInt(competencia.slice(0, 4), 10)
  const mes = parseInt(competencia.slice(4, 6), 10)
  const ini = new Date(ano, mes - 1, 1)
  const fim = new Date(ano, mes, 0, 23, 59, 59) // último dia do mês
  return { ini, fim }
}

/**
 * Limpa string p/ SPED: remove pipes (caractere reservado).
 */
export function spedStr(s: string | null | undefined, max = 255): string {
  if (!s) return ''
  return s.replace(/\|/g, '').slice(0, max)
}

/**
 * Hash MD5 simples (Node).
 */
export async function hashArquivo(conteudo: string): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('md5').update(conteudo, 'utf-8').digest('hex')
}
