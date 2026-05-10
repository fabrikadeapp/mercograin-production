/**
 * S4 M1 — Validador local de CAR (Cadastro Ambiental Rural).
 *
 * O CAR é o registro público eletrônico nacional obrigatório para todos
 * os imóveis rurais (Lei 12.651/2012). Formato:
 *
 *   UF-IBGE7-HASH
 *
 *   - UF:     2 letras (ex.: 'RS', 'MT', 'GO')
 *   - IBGE7:  7 dígitos (código IBGE do município)
 *   - HASH:   30 a 50 caracteres alfanuméricos (hash do imóvel)
 *
 * Sistema oficial: car.gov.br
 *
 * Esta lib valida apenas o FORMATO. Para validação OFICIAL contra a base
 * SICAR, usar `consultarCAR()` em `lib/br/sicar.ts` (assíncrono).
 */

const CAR_REGEX = /^[A-Z]{2}-\d{7}-[A-Z0-9]{30,50}$/

export function isValidCarFormat(car: string | null | undefined): boolean {
  if (!car || typeof car !== 'string') return false
  const clean = car.replace(/\s/g, '').toUpperCase()
  return CAR_REGEX.test(clean)
}

export interface CarParts {
  uf: string
  municipio: string // código IBGE 7 dígitos
  hash: string
}

export function parseCar(car: string | null | undefined): CarParts | null {
  if (!car || !isValidCarFormat(car)) return null
  const clean = car.replace(/\s/g, '').toUpperCase()
  const [uf, municipio, hash] = clean.split('-')
  return { uf, municipio, hash }
}

/**
 * Normaliza CAR: uppercase, sem espaços. Retorna entrada original se inválido.
 */
export function formatCar(car: string | null | undefined): string {
  if (!car) return ''
  const clean = car.replace(/\s/g, '').toUpperCase()
  if (!isValidCarFormat(clean)) return car
  return clean
}
