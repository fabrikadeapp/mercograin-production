/**
 * Validação e parsing de Chave de Acesso CT-e (modelo 57).
 *
 * Estrutura (mesma da NF-e, muda só o modelo='57'):
 *   cUF(2) + AAMM(4) + CNPJ(14) + modelo(2='57') + serie(3) + nCT(9) +
 *   tpEmis(1) + cCT(8) + cDV(1) = 44
 *
 * DV: módulo 11 com pesos cíclicos 2..9 da direita pra esquerda.
 */

export function isValidChaveCTe(chave: string): boolean {
  const clean = (chave || '').replace(/\D/g, '')
  if (clean.length !== 44) return false
  if (/^0+$/.test(clean)) return false
  if (clean.slice(20, 22) !== '57') return false

  const data = clean.slice(0, 43)
  const dv = parseInt(clean[43], 10)
  if (Number.isNaN(dv)) return false

  let soma = 0
  for (let i = 0; i < 43; i++) {
    const peso = ((43 - i - 1) % 8) + 2
    const d = parseInt(data[i], 10)
    if (Number.isNaN(d)) return false
    soma += d * peso
  }
  const resto = soma % 11
  const dvCalc = resto < 2 ? 0 : 11 - resto
  return dv === dvCalc
}

export interface ChaveCTeInfo {
  uf: string
  aamm: string
  cnpjEmissor: string
  modelo: string // '57'
  serie: string
  numero: string
  tpEmis: string
  cCT: string
  dv: string
}

export function parseChaveCTe(chave: string): ChaveCTeInfo | null {
  const clean = (chave || '').replace(/\D/g, '')
  if (!isValidChaveCTe(clean)) return null
  return {
    uf: clean.slice(0, 2),
    aamm: clean.slice(2, 6),
    cnpjEmissor: clean.slice(6, 20),
    modelo: clean.slice(20, 22),
    serie: clean.slice(22, 25),
    numero: clean.slice(25, 34),
    tpEmis: clean.slice(34, 35),
    cCT: clean.slice(35, 43),
    dv: clean.slice(43, 44),
  }
}
