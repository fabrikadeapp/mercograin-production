/**
 * QW9 — Tests para validarChaveNFe / parseChaveNFe.
 * Run: npx tsx lib/br/chave-nfe.test.ts
 */
import assert from 'node:assert/strict'
import { isValidChaveNFe, parseChaveNFe } from './chave-nfe'

// Helper local — mesma fórmula DV do mock provider, usado pra gerar chaves válidas
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

function chaveValida() {
  // cUF=43 (RS) + AAMM=2510 + CNPJ=00.000.000/0001-91 + modelo=55 + serie=001 +
  // numero=000000123 + tpEmis=1 + cNF=12345678
  const base43 =
    '43' + '2510' + '00000000000191' + '55' + '001' + '000000123' + '1' + '12345678'
  return base43 + dvChaveAcesso(base43)
}

let n = 0
function test(name: string, fn: () => void) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('chave-nfe.test.ts')

test('1. chave válida 44 dígitos retorna true', () => {
  assert.equal(isValidChaveNFe(chaveValida()), true)
})

test('2. aceita chave com máscara/espaços', () => {
  const c = chaveValida()
  const masked = c.replace(/(.{4})/g, '$1 ').trim()
  assert.equal(isValidChaveNFe(masked), true)
})

test('3. rejeita chave com DV trocado', () => {
  const c = chaveValida()
  const wrongDv = c.slice(0, 43) + (c[43] === '0' ? '1' : '0')
  assert.equal(isValidChaveNFe(wrongDv), false)
})

test('4. rejeita comprimento errado e tudo zero', () => {
  assert.equal(isValidChaveNFe('123'), false)
  assert.equal(isValidChaveNFe('0'.repeat(44)), false)
  assert.equal(isValidChaveNFe(''), false)
})

test('5. parseChaveNFe extrai campos corretos', () => {
  const info = parseChaveNFe(chaveValida())
  assert.ok(info, 'parse retornou null')
  assert.equal(info!.uf, '43')
  assert.equal(info!.aamm, '2510')
  assert.equal(info!.cnpjEmissor, '00000000000191')
  assert.equal(info!.modelo, '55')
  assert.equal(info!.serie, '001')
  assert.equal(info!.numero, '000000123')
  assert.equal(info!.tpEmis, '1')
  assert.equal(info!.cNF, '12345678')
  assert.equal(info!.dv.length, 1)
  assert.equal(parseChaveNFe('xxx'), null)
})

console.log(`\n${n}/5 tests passed.`)
