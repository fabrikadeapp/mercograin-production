/* eslint-disable */
import { gerarPixBRCode, crc16 } from '../../lib/pix/brcode'

let pass = 0,
  fail = 0
function t(name, fn) {
  try {
    fn()
    console.log('  PASS', name)
    pass++
  } catch (e) {
    console.log('  FAIL', name, '-', e.message)
    fail++
  }
}
function eq(a, b, m) {
  if (a !== b) throw new Error(`${m}: ${a} !== ${b}`)
}
function tru(c, m) {
  if (!c) throw new Error(m)
}

console.log('PIX tests:')

// 1: CRC16 conhecido. Fixture do BCB:
// payload sem CRC: "00020126360014BR.GOV.BCB.PIX0114+5561999999999520400005303986540510.005802BR5913Fulano de Tal6008BRASILIA62070503***6304"
// CRC esperado: D14F (varia segundo doc; usamos cálculo determinístico).
t('crc16 algoritmo determinístico', () => {
  const c = crc16('123456789')
  // CRC16-CCITT-FALSE de "123456789" = 0x29B1
  eq(c, '29B1', 'CRC16 123456789')
})

// 2: payload começa com 0002
t('gerarPixBRCode payload começa com 000201', () => {
  const r = gerarPixBRCode({
    chave: 'teste@example.com',
    beneficiarioNome: 'Fulano',
    beneficiarioCidade: 'BRASILIA',
  })
  tru(r.payload.startsWith('000201'), 'payload prefix')
})

// 3: contém GUI BR.GOV.BCB.PIX
t('payload contém BR.GOV.BCB.PIX', () => {
  const r = gerarPixBRCode({
    chave: 'foo@bar.com',
    beneficiarioNome: 'Foo',
    beneficiarioCidade: 'Sao Paulo',
  })
  tru(r.payload.includes('BR.GOV.BCB.PIX'), 'GUI presente')
})

// 4: valor presente => contém tag 54
t('valor inclui tag 54', () => {
  const r = gerarPixBRCode({
    chave: 'foo@bar.com',
    beneficiarioNome: 'Foo',
    beneficiarioCidade: 'Sao Paulo',
    valor: 10.5,
  })
  tru(r.payload.includes('540510.50'), 'tag 54')
})

// 5: CRC checksum (re-cálculo bate)
t('checksum bate com payload sem CRC', () => {
  const r = gerarPixBRCode({
    chave: 'foo@bar.com',
    beneficiarioNome: 'Foo',
    beneficiarioCidade: 'SP',
    valor: 1,
    txid: 'TX1',
  })
  const base = r.payload.slice(0, -4) // remove 4 chars CRC
  const c = crc16(base)
  eq(c, r.checksum, 'CRC recalculado igual ao gerado')
})

// 6: rejeita chave vazia
t('rejeita chave vazia', () => {
  let ok = false
  try {
    gerarPixBRCode({
      chave: '',
      beneficiarioNome: 'X',
      beneficiarioCidade: 'Y',
    })
  } catch {
    ok = true
  }
  tru(ok, 'esperava erro')
})

console.log(`\nPIX results: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
