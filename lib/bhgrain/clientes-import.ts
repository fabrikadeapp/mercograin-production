/**
 * BH Grain — Importação de clientes via CSV.
 *
 * Função pura (recebe texto, retorna lista de records validados + erros).
 * Persistência é responsabilidade do caller (server action).
 */

import { parseCsv, findColumn } from './csv-parser'

export interface ClienteImportRow {
  nome: string
  tipo: string
  email: string | null
  whatsapp: string | null
  telefone: string | null
  cnpj: string | null
  cpf: string | null
  endereco: string | null
}

export interface ImportError {
  linha: number
  campo: string
  motivo: string
  valor: string
}

export interface ImportPreview {
  total: number
  validos: ClienteImportRow[]
  erros: ImportError[]
  mapping: Record<string, string | null>
}

const SIN_NOME = ['nome', 'cliente', 'razao social', 'razão social', 'nome cliente', 'name']
const SIN_TIPO = ['tipo', 'tipo cliente', 'classificacao', 'kind']
const SIN_EMAIL = ['email', 'e-mail', 'mail', 'contato email']
const SIN_WHATS = ['whatsapp', 'whats', 'celular', 'wpp']
const SIN_TEL = ['telefone', 'fone', 'tel', 'phone']
const SIN_CNPJ = ['cnpj', 'cnpj cliente']
const SIN_CPF = ['cpf', 'cpf cliente']
const SIN_END = ['endereco', 'endereço', 'address', 'rua']

function digits(s: string | null): string {
  return (s ?? '').replace(/\D/g, '')
}

function validateCnpj(c: string): boolean {
  const d = digits(c)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false
  // Validação por DV
  const calc = (slice: number) => {
    const w = slice === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < w.length; i++) sum += parseInt(d[i], 10) * w[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10)
}

function validateCpf(c: string): boolean {
  const d = digits(c)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  const calc = (n: number) => {
    let sum = 0
    for (let i = 0; i < n; i++) sum += parseInt(d[i], 10) * (n + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10)
}

function formatCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatCpf(d: string): string {
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

export function parseClientesCsv(csv: string): ImportPreview {
  const parsed = parseCsv(csv)
  const erros: ImportError[] = []
  const validos: ClienteImportRow[] = []

  const colNome = findColumn(parsed.headers, SIN_NOME)
  const colTipo = findColumn(parsed.headers, SIN_TIPO)
  const colEmail = findColumn(parsed.headers, SIN_EMAIL)
  const colWhats = findColumn(parsed.headers, SIN_WHATS)
  const colTel = findColumn(parsed.headers, SIN_TEL)
  const colCnpj = findColumn(parsed.headers, SIN_CNPJ)
  const colCpf = findColumn(parsed.headers, SIN_CPF)
  const colEnd = findColumn(parsed.headers, SIN_END)

  const mapping = {
    nome: colNome,
    tipo: colTipo,
    email: colEmail,
    whatsapp: colWhats,
    telefone: colTel,
    cnpj: colCnpj,
    cpf: colCpf,
    endereco: colEnd,
  }

  if (!colNome) {
    erros.push({ linha: 0, campo: 'nome', motivo: 'Coluna "nome" obrigatória não encontrada', valor: parsed.headers.join('|') })
    return { total: parsed.rows.length, validos: [], erros, mapping }
  }

  const cnpjsVistos = new Set<string>()
  const cpfsVistos = new Set<string>()

  parsed.rows.forEach((row, idx) => {
    const linha = idx + 2 // header é linha 1
    const nome = (row[colNome] ?? '').trim()
    if (!nome) {
      erros.push({ linha, campo: 'nome', motivo: 'Nome vazio', valor: '' })
      return
    }
    if (nome.length > 255) {
      erros.push({ linha, campo: 'nome', motivo: 'Nome > 255 caracteres', valor: nome.slice(0, 60) })
      return
    }

    let cnpj: string | null = null
    if (colCnpj && row[colCnpj]) {
      const raw = row[colCnpj].trim()
      const d = digits(raw)
      if (d.length === 14) {
        if (!validateCnpj(d)) {
          erros.push({ linha, campo: 'cnpj', motivo: 'CNPJ inválido (dígito verificador)', valor: raw })
          return
        }
        if (cnpjsVistos.has(d)) {
          erros.push({ linha, campo: 'cnpj', motivo: 'CNPJ duplicado dentro do arquivo', valor: raw })
          return
        }
        cnpjsVistos.add(d)
        cnpj = formatCnpj(d)
      } else if (raw.length > 0) {
        erros.push({ linha, campo: 'cnpj', motivo: 'CNPJ não tem 14 dígitos', valor: raw })
        return
      }
    }

    let cpf: string | null = null
    if (colCpf && row[colCpf]) {
      const raw = row[colCpf].trim()
      const d = digits(raw)
      if (d.length === 11) {
        if (!validateCpf(d)) {
          erros.push({ linha, campo: 'cpf', motivo: 'CPF inválido (dígito verificador)', valor: raw })
          return
        }
        if (cpfsVistos.has(d)) {
          erros.push({ linha, campo: 'cpf', motivo: 'CPF duplicado dentro do arquivo', valor: raw })
          return
        }
        cpfsVistos.add(d)
        cpf = formatCpf(d)
      } else if (raw.length > 0) {
        erros.push({ linha, campo: 'cpf', motivo: 'CPF não tem 11 dígitos', valor: raw })
        return
      }
    }

    const email = colEmail ? (row[colEmail] ?? '').trim() || null : null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      erros.push({ linha, campo: 'email', motivo: 'Email inválido', valor: email })
      return
    }

    const tipoRaw = (colTipo ? (row[colTipo] ?? '').trim().toLowerCase() : 'ambos') || 'ambos'
    const tipo = ['comprador', 'vendedor', 'ambos'].includes(tipoRaw) ? tipoRaw : 'ambos'

    validos.push({
      nome,
      tipo,
      email,
      whatsapp: colWhats ? (row[colWhats] ?? '').trim() || null : null,
      telefone: colTel ? (row[colTel] ?? '').trim() || null : null,
      cnpj,
      cpf,
      endereco: colEnd ? (row[colEnd] ?? '').trim() || null : null,
    })
  })

  return { total: parsed.rows.length, validos, erros, mapping }
}
