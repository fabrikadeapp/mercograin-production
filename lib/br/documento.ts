/**
 * Validação e formatação de documentos brasileiros (CPF / CNPJ).
 *
 * Algoritmos baseados na especificação oficial da Receita Federal
 * (dígitos verificadores módulo 11).
 *
 * Aceita strings com ou sem máscara — a função normaliza removendo
 * tudo que não é dígito antes da verificação.
 */

/**
 * Valida CPF brasileiro pelos dígitos verificadores.
 * Aceita com ou sem formatação (000.000.000-00 ou 00000000000).
 */
export function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false // todos iguais

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(clean[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return d2 === parseInt(clean[10])
}

/**
 * Valida CNPJ brasileiro pelos dígitos verificadores.
 * Aceita com ou sem formatação (00.000.000/0000-00 ou 00000000000000).
 */
export function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  const calc = (slice: string, weights: number[]): number => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(slice[i]) * weights[i]
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = calc(clean.substring(0, 12), w1)
  if (d1 !== parseInt(clean[12])) return false
  const d2 = calc(clean.substring(0, 13), w2)
  return d2 === parseInt(clean[13])
}

export function formatCPF(cpf: string): string {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11) return cpf
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`
}

export function formatCNPJ(cnpj: string): string {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`
}

export function detectDocumentoType(doc: string): 'cpf' | 'cnpj' | null {
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11 && isValidCPF(clean)) return 'cpf'
  if (clean.length === 14 && isValidCNPJ(clean)) return 'cnpj'
  return null
}
