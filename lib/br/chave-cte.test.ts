/**
 * Tests para isValidChaveCTe / parseChaveCTe.
 * Run: npx tsx lib/br/chave-cte.test.ts
 */
import assert from 'node:assert/strict'
import { isValidChaveCTe, parseChaveCTe } from './chave-cte'

function dvChaveAcesso(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  for (let i = 0; i < chave43.length; i++) {
    const d = parseInt(chave43[chave43.length - 1 - i], 10)
    soma += d * pesos[i % pesos.length]
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return String(dv)
}

function chaveCTeValida() {
  // cUF=41 (PR) + AAMM=2603 + CNPJ + modelo=57 + serie=001 + nCT + tpEmis + cCT
  const base43 =
    '41' + '2603' + '12345678000195' + '57' + '001' + '000000777' + '1' + '87654321'
  return base43 + dvChaveAcesso(base43)
}

let n = 0
function test(name: string, fn: () => void) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('chave-cte.test.ts')

test('1. CT-e válida 44 dígitos retorna true', () => {
  assert.equal(isValidChaveCTe(chaveCTeValida()), true)
})

test('2. rejeita modelo ≠ 57 (ex.: 55 que é NF-e)', () => {
  const c = chaveCTeValida()
  // troca modelo 57→55 sem recalcular DV — deve falhar tanto por modelo quanto por DV
  const adulterada = c.slice(0, 20) + '55' + c.slice(22)
  assert.equal(isValidChaveCTe(adulterada), false)
})

test('3. aceita máscara/espaços e parse retorna campos', () => {
  const c = chaveCTeValida()
  const masked = c.replace(/(.{4})/g, '$1 ').trim()
  assert.equal(isValidChaveCTe(masked), true)
  const info = parseChaveCTe(c)
  assert.ok(info)
  assert.equal(info!.modelo, '57')
  assert.equal(info!.uf, '41')
  assert.equal(info!.cnpjEmissor, '12345678000195')
  assert.equal(info!.numero, '000000777')
})

test('4. rejeita DV trocado, comprimento e tudo zero', () => {
  const c = chaveCTeValida()
  const wrong = c.slice(0, 43) + (c[43] === '0' ? '1' : '0')
  assert.equal(isValidChaveCTe(wrong), false)
  assert.equal(isValidChaveCTe('abc'), false)
  assert.equal(isValidChaveCTe('0'.repeat(44)), false)
})

test('5. parseChaveCTe retorna null pra chave inválida', () => {
  assert.equal(parseChaveCTe('123'), null)
  assert.equal(parseChaveCTe('0'.repeat(44)), null)
})

console.log(`  ${n} tests passed`)
