/**
 * Tests para isValidChaveMDFe / parseChaveMDFe.
 * Run: npx tsx lib/br/chave-mdfe.test.ts
 */
import assert from 'node:assert/strict'
import { isValidChaveMDFe, parseChaveMDFe } from './chave-mdfe'

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

function chaveMDFeValida() {
  // cUF=51 (MT) + AAMM=2604 + CNPJ + modelo=58 + serie=001 + nMDF + tpEmis + cMDF
  const base43 =
    '51' + '2604' + '11222333000181' + '58' + '001' + '000001234' + '1' + '99887766'
  return base43 + dvChaveAcesso(base43)
}

let n = 0
function test(name: string, fn: () => void) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('chave-mdfe.test.ts')

test('1. MDF-e válida 44 dígitos retorna true', () => {
  assert.equal(isValidChaveMDFe(chaveMDFeValida()), true)
})

test('2. rejeita modelo ≠ 58', () => {
  const c = chaveMDFeValida()
  const adulterada = c.slice(0, 20) + '57' + c.slice(22)
  assert.equal(isValidChaveMDFe(adulterada), false)
})

test('3. parse retorna campos esperados', () => {
  const info = parseChaveMDFe(chaveMDFeValida())
  assert.ok(info)
  assert.equal(info!.modelo, '58')
  assert.equal(info!.uf, '51')
  assert.equal(info!.cnpjEmissor, '11222333000181')
  assert.equal(info!.numero, '000001234')
  assert.equal(info!.tpEmis, '1')
})

test('4. rejeita DV inválido, vazio, tudo zero', () => {
  const c = chaveMDFeValida()
  const wrong = c.slice(0, 43) + (c[43] === '0' ? '1' : '0')
  assert.equal(isValidChaveMDFe(wrong), false)
  assert.equal(isValidChaveMDFe(''), false)
  assert.equal(isValidChaveMDFe('0'.repeat(44)), false)
})

test('5. aceita máscara/pontuação', () => {
  const c = chaveMDFeValida()
  const masked = c.replace(/(.{4})/g, '$1.').replace(/\.$/, '')
  assert.equal(isValidChaveMDFe(masked), true)
})

console.log(`  ${n} tests passed`)
