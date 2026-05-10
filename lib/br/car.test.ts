/**
 * Testes do validador CAR.
 * Executar: npx ts-node lib/br/car.test.ts
 */
import { isValidCarFormat, parseCar, formatCar } from './car'

let pass = 0
let fail = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    pass++
    console.log('  PASS:', label)
  } else {
    fail++
    console.error('  FAIL:', label)
  }
}

console.log('# CAR validator')

// Válidos
assert(
  isValidCarFormat('RS-4314902-A1B2C3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E'),
  'CAR RS válido (40 chars)'
)
assert(
  isValidCarFormat('mt-5103403-ABCDEF0123456789ABCDEF0123456789ABCDEF'),
  'CAR MT lowercase aceito (normalizado)'
)
assert(
  isValidCarFormat(' MT-5103403-ABCDEF0123456789ABCDEF0123456789ABCDEF '),
  'CAR com whitespace é trimado'
)

// Inválidos
assert(!isValidCarFormat(''), 'string vazia inválida')
assert(!isValidCarFormat('AB123456-ABC'), 'sem hifens inválido')
assert(!isValidCarFormat('R-4314902-ABCDEF0123456789ABCDEF0123456789AB'), 'UF com 1 letra inválida')
assert(!isValidCarFormat('RS-43149-ABCDEF0123456789ABCDEF0123456789ABCDEF'), 'IBGE com 5 dígitos inválido')
assert(!isValidCarFormat('RS-4314902-ABC'), 'hash curto inválido')
assert(!isValidCarFormat(null as any), 'null inválido')

// parseCar
const parts = parseCar('RS-4314902-A1B2C3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E')
assert(parts !== null && parts.uf === 'RS', 'parseCar UF=RS')
assert(parts !== null && parts.municipio === '4314902', 'parseCar IBGE=4314902')
assert(parts !== null && parts.hash.length === 40, 'parseCar hash length=40')
assert(parseCar('invalid') === null, 'parseCar inválido retorna null')

// formatCar
assert(
  formatCar(' rs-4314902-a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e ') ===
    'RS-4314902-A1B2C3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E',
  'formatCar normaliza upper e trim'
)
assert(formatCar('inválido') === 'inválido', 'formatCar retorna original se inválido')

console.log(`\nTotal: ${pass} pass / ${fail} fail`)
if (fail > 0) process.exit(1)
