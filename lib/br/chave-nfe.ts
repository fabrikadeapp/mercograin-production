/**
 * QW9 — Validação e parsing de Chave de Acesso NF-e (44 dígitos).
 *
 * Estrutura da chave (NT 2009/006):
 *   cUF (2) + AAMM (4) + CNPJ emitente (14) + modelo (2) + serie (3) +
 *   nNF (9) + tpEmis (1) + cNF (8) + cDV (1) = 44 dígitos
 *
 * O dígito verificador (cDV) é calculado por módulo 11 com pesos cíclicos
 * 2..9 da direita pra esquerda.
 */

/** Aceita string com ou sem máscara (espaços, pontos, hífens). */
export function isValidChaveNFe(chave: string): boolean {
  const clean = (chave || '').replace(/\D/g, '')
  if (clean.length !== 44) return false
  // Tudo zero é inválido
  if (/^0+$/.test(clean)) return false

  const data = clean.slice(0, 43)
  const dv = parseInt(clean[43], 10)
  if (Number.isNaN(dv)) return false

  let soma = 0
  for (let i = 0; i < 43; i++) {
    // peso cíclico 2..9 começando da direita
    const peso = ((43 - i - 1) % 8) + 2
    const d = parseInt(data[i], 10)
    if (Number.isNaN(d)) return false
    soma += d * peso
  }
  const resto = soma % 11
  const dvCalc = resto < 2 ? 0 : 11 - resto
  return dv === dvCalc
}

export interface ChaveNFeInfo {
  uf: string
  aamm: string
  cnpjEmissor: string
  modelo: string
  serie: string
  numero: string
  tpEmis: string
  cNF: string
  dv: string
}

export function parseChaveNFe(chave: string): ChaveNFeInfo | null {
  const clean = (chave || '').replace(/\D/g, '')
  if (!isValidChaveNFe(clean)) return null
  return {
    uf: clean.slice(0, 2),
    aamm: clean.slice(2, 6),
    cnpjEmissor: clean.slice(6, 20),
    modelo: clean.slice(20, 22),
    serie: clean.slice(22, 25),
    numero: clean.slice(25, 34),
    tpEmis: clean.slice(34, 35),
    cNF: clean.slice(35, 43),
    dv: clean.slice(43, 44),
  }
}
