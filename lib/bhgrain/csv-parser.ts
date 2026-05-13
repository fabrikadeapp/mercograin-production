/**
 * BH Grain — Parser CSV minimalista (sem dependência externa).
 *
 * Suporta:
 *  - Delimitadores , ; ou tab (auto-detecta pela primeira linha)
 *  - Aspas duplas com escape ""
 *  - Header obrigatório
 *  - Linhas em branco ignoradas
 *
 * Função pura — sem I/O.
 */

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
  delimiter: ',' | ';' | '\t'
}

export function parseCsv(content: string): ParsedCsv {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return { headers: [], rows: [], delimiter: ',' }

  const firstLine = text.split('\n', 1)[0]
  const commaCount = (firstLine.match(/,/g) ?? []).length
  const semiCount = (firstLine.match(/;/g) ?? []).length
  const tabCount = (firstLine.match(/\t/g) ?? []).length
  const delimiter: ',' | ';' | '\t' =
    semiCount > commaCount && semiCount > tabCount ? ';' : tabCount > commaCount ? '\t' : ','

  const allRows = splitLines(text).map((line) => parseLine(line, delimiter))
  if (allRows.length === 0) return { headers: [], rows: [], delimiter }

  const headers = allRows[0].map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i]
    if (cells.length === 1 && cells[0] === '') continue
    const row: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? '').trim()
    }
    rows.push(row)
  }
  return { headers, rows, delimiter }
}

// Divide o conteúdo em linhas respeitando aspas (newline dentro de campo entre aspas é parte do campo)
function splitLines(text: string): string[] {
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      // double-quote escape
      if (inQuotes && text[i + 1] === '"') {
        cur += '""'
        i++
        continue
      }
      inQuotes = !inQuotes
      cur += c
      continue
    }
    if (c === '\n' && !inQuotes) {
      lines.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.length > 0) lines.push(cur)
  return lines
}

function parseLine(line: string, delimiter: ',' | ';' | '\t'): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (c === delimiter && !inQuotes) {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  cells.push(cur)
  return cells
}

/**
 * Resolve uma coluna pelo nome, com tolerância a maiúsculas/acentos/sinônimos.
 */
export function findColumn(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  const normHeaders = headers.map((h) => ({ raw: h, norm: norm(h) }))
  for (const cand of candidates) {
    const n = norm(cand)
    const hit = normHeaders.find((h) => h.norm === n)
    if (hit) return hit.raw
  }
  return null
}
