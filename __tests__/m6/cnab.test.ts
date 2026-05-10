/* eslint-disable */
// Run: node __tests__/m6/cnab.test.js
const path = require('path')

import { parseCnab, parseCnab240, parseCnab400 } from '../../lib/cnab'
import { parseCnabDate, parseCnabValor } from '../../lib/cnab/types'

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
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`)
}
function tru(c, m) {
  if (!c) throw new Error(m)
}

console.log('CNAB tests:')

// 1: parseCnabDate
t('parseCnabDate DDMMAAAA', () => {
  eq(parseCnabDate('15032025'), '2025-03-15', 'date 8')
})

// 2: parseCnabDate invalid
t('parseCnabDate vazio', () => {
  eq(parseCnabDate('00000000'), null, 'date null')
})

// 3: parseCnabValor centavos
t('parseCnabValor centavos', () => {
  eq(parseCnabValor('0000000015000'), 150.0, 'valor 150')
})

// 4: CNAB 240 com 1 título liquidado
function pad(s, n, ch = ' ') {
  s = String(s)
  return s.length >= n ? s.slice(0, n) : s + ch.repeat(n - s.length)
}
function padL(s, n, ch = '0') {
  s = String(s)
  return s.length >= n ? s.slice(-n) : ch.repeat(n - s.length) + s
}

function build240() {
  // Header (240)
  const header = pad('341', 3) + pad('', 5) + '0' + pad('', 231) // tipo 0 col8
  // Detalhe T (segmento col14='T', tipo 3 col8)
  let t = pad('341', 3) + pad('', 4) + '3' // 8 chars
  t += pad('', 5) // 8-13
  t += 'T' // col14 idx 13
  t += '0' // mov type idx 14
  t += '06' // ocorrencia idx 15-16
  // currently: 14 + T + mov(1) + oc(2) = 17. OK.
  t += pad('', 37 - 17) // até 37
  t += pad('NN12345', 20) // nossoNumero 37-57
  t += pad('', 1) // 57-58
  t += pad('DOC001', 15) // 58-73 seu numero
  t += '15032025' // 73-81 venc
  t += padL('1500000', 15) // 81-96 valor titulo = 15.000,00
  t += pad('', 240 - t.length)
  // Detalhe U
  let u = pad('341', 3) + pad('', 4) + '3'
  u += pad('', 5)
  u += 'U'
  u += '0' // mov type
  u += '06'
  u += padL('1500000', 15) // 17-32 valor pago
  u += pad('', 137 - 32)
  u += '15032025' // 137-145 data pagamento
  u += pad('', 240 - u.length)
  // Trailer
  const trailer = pad('341', 3) + pad('', 4) + '9' + pad('', 232)
  return [header, t, u, trailer].join('\n')
}

t('CNAB 240 - parse 1 título liquidado', () => {
  const out = parseCnab240(build240())
  tru(out.detalhes.length === 1, 'esperava 1 detalhe, got ' + out.detalhes.length)
  const d = out.detalhes[0]
  eq(d.seuNumero, 'DOC001', 'seu numero')
  eq(d.valorTitulo, 15000, 'valor titulo')
  eq(d.valorPago, 15000, 'valor pago')
  eq(d.ocorrenciaCodigo, '06', 'oc')
  eq(d.dataVencimento, '2025-03-15', 'venc')
  eq(d.dataPagamento, '2025-03-15', 'pgto')
})

// 5: CNAB 240 detect via parseCnab
t('parseCnab autodetect 240', () => {
  const out = parseCnab(build240())
  eq(out.header.layout, '240', 'layout')
})

// 6: CNAB 400 baixa rejeitada
function build400(oc = '06') {
  let l = pad('1', 1) // tipo 1
  l += pad('', 70 - 1)
  l += pad('NN999', 12) // 70-82 nossoNumero
  l += pad('', 108 - 82)
  l += oc // 108-110
  l += '150325' // 110-116 data ocorrencia
  l += pad('DOC400', 10) // 116-126 seu numero
  l += pad('', 146 - 126)
  l += '200325' // 146-152 venc
  l += padL('2500000', 13) // 152-165 valor titulo
  l += pad('', 253 - 165)
  l += padL('2500000', 13) // 253-266 valor pago
  l += pad('', 295 - 266)
  l += '180325' // 295-301 data pgto
  l += pad('', 400 - l.length)
  // Header CNAB400
  const hdr = pad('0', 1) + pad('', 76 - 1) + pad('341', 3) + pad('', 400 - 79)
  const tr = pad('9', 1) + pad('', 399)
  return [hdr, l, tr].join('\n')
}

t('CNAB 400 - liquidação 06', () => {
  const out = parseCnab400(build400('06'))
  tru(out.detalhes.length === 1)
  const d = out.detalhes[0]
  eq(d.ocorrenciaCodigo, '06', 'oc')
  eq(d.valorPago, 25000, 'valor pago')
  eq(d.dataPagamento, '2025-03-18', 'pgto')
})

// 7: CNAB 400 baixa rejeitada (27) → valorPago=0
t('CNAB 400 - baixa rejeitada 27 valorPago=0', () => {
  const out = parseCnab400(build400('27'))
  const d = out.detalhes[0]
  eq(d.ocorrenciaCodigo, '27', 'oc 27')
  eq(d.valorPago, 0, 'valor pago zero')
})

// 8: detect 400
t('parseCnab autodetect 400', () => {
  const out = parseCnab(build400('06'))
  eq(out.header.layout, '400', 'layout 400')
})

console.log(`\nCNAB results: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
