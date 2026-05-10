/**
 * Tests para lib/fiscal/calculo-tributos.
 * Run: npx tsx lib/fiscal/calculo-tributos.test.ts
 */
import { calcularTributos, calcularTotaisNF, type ItemNF } from './calculo-tributos'

let pass = 0
let fail = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function approxEq(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) < eps
}

const baseSoja: ItemNF = {
  descricao: 'Soja em grão',
  ncm: '12019000',
  cfop: '1102',
  qtd: 1000,
  unidade: 'SC',
  valorUnitario: 130,
  valorTotal: 130000,
  origemUF: 'RS',
  destinoUF: 'RS',
  destinatarioTipo: 'PF',
  operacao: 'compra_produtor',
}

console.log('\n== Test 1: Compra soja produtor PF intra-RS (FUNRURAL + diferimento) ==')
{
  const t = calcularTributos(baseSoja, 'lucro_presumido')
  assert(approxEq(t.valorFUNRURAL, 1690), 'FUNRURAL 1.3% sobre 130k = 1690', `got ${t.valorFUNRURAL}`)
  assert(t.valorICMS === 0, 'ICMS diferido (intra RS produto primário)', `got ${t.valorICMS}`)
  assert(t.valorPIS === 0, 'PIS zero (soja em natura — Lei 10.925)', `got ${t.valorPIS}`)
  assert(t.valorCOFINS === 0, 'COFINS zero (idem)', `got ${t.valorCOFINS}`)
}

console.log('\n== Test 2: Venda soja inter-estadual RS→GO 7% ==')
{
  const it: ItemNF = {
    ...baseSoja,
    cfop: '6101',
    origemUF: 'RS',
    destinoUF: 'GO',
    destinatarioTipo: 'PJ',
    operacao: 'venda_industria',
  }
  const t = calcularTributos(it, 'lucro_presumido')
  assert(approxEq(t.valorICMS, 9100), 'ICMS 7% sobre 130k = 9100', `got ${t.valorICMS}`)
  assert(t.aliquotaICMS === 0.07, 'Alíquota inter 7%', `got ${t.aliquotaICMS}`)
  assert(t.valorFUNRURAL === 0, 'Sem FUNRURAL (venda industria)', `got ${t.valorFUNRURAL}`)
}

console.log('\n== Test 3: Venda inter-estadual MT→PR 12% ==')
{
  const it: ItemNF = {
    ...baseSoja,
    cfop: '6101',
    origemUF: 'MT',
    destinoUF: 'PR',
    destinatarioTipo: 'PJ',
    operacao: 'venda_industria',
  }
  const t = calcularTributos(it, 'lucro_presumido')
  assert(t.aliquotaICMS === 0.12, 'Alíquota inter MT→PR = 12%', `got ${t.aliquotaICMS}`)
}

console.log('\n== Test 4: Lucro Real — PIS 1.65% + COFINS 7.6% (item não-primário) ==')
{
  const it: ItemNF = {
    ...baseSoja,
    ncm: '23040090', // farelo de soja (não está na lista alíquota zero deste mock)
    cfop: '6101',
    destinoUF: 'SC',
    destinatarioTipo: 'PJ',
    operacao: 'venda_industria',
  }
  const t = calcularTributos(it, 'lucro_real')
  assert(approxEq(t.valorPIS, 2145), 'PIS 1.65% sobre 130k = 2145', `got ${t.valorPIS}`)
  assert(approxEq(t.valorCOFINS, 9880), 'COFINS 7.6% sobre 130k = 9880', `got ${t.valorCOFINS}`)
}

console.log('\n== Test 5: Simples Nacional — PIS/COFINS embutidos no DAS ==')
{
  const it: ItemNF = { ...baseSoja, ncm: '23040090', operacao: 'venda_industria', destinatarioTipo: 'PJ', destinoUF: 'SC' }
  const t = calcularTributos(it, 'simples_nacional')
  assert(t.valorPIS === 0 && t.valorCOFINS === 0, 'PIS+COFINS zero no Simples', `got pis=${t.valorPIS} cof=${t.valorCOFINS}`)
  assert(t.observacoes.some((o) => /Simples/.test(o)), 'Observação Simples presente')
}

console.log('\n== Test 6: Exportação — ICMS isento (Lei Kandir) ==')
{
  const it: ItemNF = { ...baseSoja, operacao: 'venda_exportacao', destinoUF: 'PA', destinatarioTipo: 'PJ' }
  const t = calcularTributos(it, 'lucro_presumido')
  assert(t.valorICMS === 0, 'ICMS isento exportação', `got ${t.valorICMS}`)
  assert(t.observacoes.some((o) => /Kandir|exportação/i.test(o)), 'Observação Kandir')
}

console.log('\n== Test 7: Milho compra PF intra-PR diferido + FUNRURAL ==')
{
  const it: ItemNF = {
    descricao: 'Milho em grão',
    ncm: '10059090',
    cfop: '1102',
    qtd: 500,
    unidade: 'SC',
    valorUnitario: 60,
    valorTotal: 30000,
    origemUF: 'PR',
    destinoUF: 'PR',
    destinatarioTipo: 'PF',
    operacao: 'compra_produtor',
  }
  const t = calcularTributos(it, 'lucro_presumido')
  assert(approxEq(t.valorFUNRURAL, 390), 'FUNRURAL 1.3% sobre 30k = 390', `got ${t.valorFUNRURAL}`)
  assert(t.valorICMS === 0, 'Diferimento PR milho', `got ${t.valorICMS}`)
}

console.log('\n== Test 8: Agregação calcularTotaisNF ==')
{
  const itens: ItemNF[] = [baseSoja, { ...baseSoja, qtd: 500, valorTotal: 65000 }]
  const t = calcularTotaisNF(itens, 'lucro_presumido')
  assert(t.valorProdutos === 195000, 'Soma valorProdutos', `got ${t.valorProdutos}`)
  assert(approxEq(t.valorFUNRURAL, 2535), 'FUNRURAL agregado = 2535', `got ${t.valorFUNRURAL}`)
}

console.log('\n== Test 9: Trigo intra-SC diferimento ==')
{
  const it: ItemNF = {
    descricao: 'Trigo em grão',
    ncm: '10011900',
    cfop: '1102',
    qtd: 200,
    unidade: 'SC',
    valorUnitario: 80,
    valorTotal: 16000,
    origemUF: 'SC',
    destinoUF: 'SC',
    destinatarioTipo: 'PJ',
    operacao: 'compra_produtor',
  }
  const t = calcularTributos(it, 'lucro_presumido')
  assert(t.valorICMS === 0, 'Trigo intra-SC diferido', `got ${t.valorICMS}`)
  assert(t.valorFUNRURAL === 0, 'Sem FUNRURAL (PJ)', `got ${t.valorFUNRURAL}`)
}

console.log(`\nResultado: ${pass} PASS / ${fail} FAIL`)
if (fail > 0) process.exit(1)
