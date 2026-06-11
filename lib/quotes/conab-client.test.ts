/**
 * Tests para lib/quotes/conab-client.ts
 * Run: npx tsx lib/quotes/conab-client.test.ts
 *
 * Cobre parseCsv (função pura, tolera padding de espaços) e agregarPorAno
 * (Brasil total: soma UFs para soja, usa MILHO TOTAL para milho).
 */
import { parseCsv, agregarPorAno } from './conab-client'

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

function approxEq(a: number, b: number, eps = 1e-4) {
  return Math.abs(a - b) < eps
}

// CSV de exemplo no estilo real da CONAB: header + linhas com padding de
// espaços nos campos. Cabeçalho: ano_agricola;dsc_safra_previsao;uf;produto;
// id_produto;area_plantada_mil_ha;producao_mil_t;produtividade_mil_ha_mil_t
const CSV = [
  'ano_agricola;dsc_safra_previsao;uf;produto;id_produto;area_plantada_mil_ha;producao_mil_t;produtividade_mil_ha_mil_t',
  '2023/24 ; 12º Levantamento ; RS ; SOJA ; 1 ; 6500.0 ; 21500.0 ; 3.308 ',
  '2023/24 ; 12º Levantamento ; PR ; SOJA ; 1 ; 5800.0 ; 20000.0 ; 3.448 ',
  '2022/23 ; Final ; RS ; SOJA ; 1 ; 6300.0 ; 12000.0 ; 1.905 ',
  '2023/24 ; 12º Levantamento ; MT ; MILHO TOTAL ; 5 ; 7000.0 ; 50000.0 ; 7.143 ',
  '2023/24 ; 12º Levantamento ; MT ; MILHO 1A SAFRA ; 6 ; 1000.0 ; 9000.0 ; 9.0 ',
  '2023/24 ; 12º Levantamento ; MT ; MILHO 2A SAFRA ; 7 ; 6000.0 ; 41000.0 ; 6.833 ',
  '2022/23 ; Final ; MT ; MILHO TOTAL ; 5 ; 6800.0 ; 45000.0 ; 6.618 ',
  '2023/24 ; 12º Levantamento ; SP ; TRIGO ; 9 ; 100.0 ; 300.0 ; 3.0 ', // ignorado
].join('\n')

// ── parseCsv: filtra só soja/milho, trim de padding, numérico ───────────────
{
  const regs = parseCsv(CSV)
  // soja: 3 linhas (RS+PR 23/24, RS 22/23); milho: TOTAL 2 + 1A + 2A = 4; trigo ignorado
  assert(regs.length === 7, 'parseCsv: 7 registros (trigo excluído)', `${regs.length}`)

  const soja2324 = regs.filter((r) => r.produto === 'SOJA' && r.anoAgricola === '2023/24')
  assert(soja2324.length === 2, 'parseCsv: 2 UFs de soja em 2023/24', `${soja2324.length}`)

  const rs = soja2324.find((r) => r.uf === 'RS')!
  assert(rs.uf === 'RS', 'parseCsv: padding removido da UF (RS)', JSON.stringify(rs?.uf))
  assert(approxEq(rs.areaMilHa, 6500), 'parseCsv: area numérica 6500', `${rs.areaMilHa}`)
  assert(approxEq(rs.producaoMilT, 21500), 'parseCsv: producao numérica 21500', `${rs.producaoMilT}`)
  assert(approxEq(rs.produtividade, 3.308), 'parseCsv: produtividade 3.308', `${rs.produtividade}`)

  const milhoTotal = regs.filter((r) => r.produto === 'MILHO TOTAL')
  assert(milhoTotal.length === 2, 'parseCsv: 2 linhas MILHO TOTAL', `${milhoTotal.length}`)

  const milhoParcial = regs.filter((r) => r.produto === 'MILHO')
  assert(milhoParcial.length === 2, 'parseCsv: 1A+2A normalizados como MILHO', `${milhoParcial.length}`)

  const trigo = regs.find((r) => r.uf === 'SP')
  assert(trigo === undefined, 'parseCsv: TRIGO ignorado', JSON.stringify(trigo))
}

// ── agregarPorAno SOJA: soma UFs por ano, ordena desc ───────────────────────
{
  const regs = parseCsv(CSV)
  const soja = agregarPorAno(regs, 'SOJA')
  assert(soja.length === 2, 'agregar soja: 2 anos', `${soja.length}`)
  assert(soja[0].anoAgricola === '2023/24', 'agregar soja: ordenado desc (23/24 primeiro)', soja[0].anoAgricola)

  const atual = soja[0]
  // RS 21500 + PR 20000 = 41500 mil t; area 6500+5800 = 12300 mil ha
  assert(approxEq(atual.producaoMilT, 41500), 'agregar soja: producao Brasil 41500', `${atual.producaoMilT}`)
  assert(approxEq(atual.areaMilHa, 12300), 'agregar soja: area Brasil 12300', `${atual.areaMilHa}`)
  // produtividade recalculada = 41500/12300 ≈ 3.3739
  assert(approxEq(atual.produtividade, 41500 / 12300), 'agregar soja: produtividade recalculada', `${atual.produtividade}`)
}

// ── agregarPorAno MILHO: usa MILHO TOTAL (não soma 1A+2A em dobro) ──────────
{
  const regs = parseCsv(CSV)
  const milho = agregarPorAno(regs, 'MILHO')
  assert(milho.length === 2, 'agregar milho: 2 anos', `${milho.length}`)
  assert(milho[0].anoAgricola === '2023/24', 'agregar milho: ordenado desc', milho[0].anoAgricola)
  // Usa MILHO TOTAL (50000), NÃO 50000 + 9000 + 41000.
  assert(approxEq(milho[0].producaoMilT, 50000), 'agregar milho: usa MILHO TOTAL (50000, sem dupla contagem)', `${milho[0].producaoMilT}`)
  assert(approxEq(milho[1].producaoMilT, 45000), 'agregar milho: ano anterior 45000', `${milho[1].producaoMilT}`)
}

// ── agregarPorAno MILHO fallback: sem TOTAL, soma 1A+2A ──────────────────────
{
  const csvSemTotal = [
    'ano_agricola;dsc_safra_previsao;uf;produto;id_produto;area_plantada_mil_ha;producao_mil_t;produtividade_mil_ha_mil_t',
    '2023/24 ; X ; MT ; MILHO 1A SAFRA ; 6 ; 1000.0 ; 9000.0 ; 9.0 ',
    '2023/24 ; X ; PR ; MILHO 2A SAFRA ; 7 ; 6000.0 ; 41000.0 ; 6.833 ',
  ].join('\n')
  const regs = parseCsv(csvSemTotal)
  const milho = agregarPorAno(regs, 'MILHO')
  assert(milho.length === 1, 'fallback milho: 1 ano', `${milho.length}`)
  // Sem TOTAL → soma 1A (9000) + 2A (41000) = 50000.
  assert(approxEq(milho[0].producaoMilT, 50000), 'fallback milho: soma 1A+2A = 50000', `${milho[0].producaoMilT}`)
}

// ── parseCsv: entrada vazia / linhas malformadas ────────────────────────────
{
  assert(parseCsv('').length === 0, 'parseCsv: texto vazio → []')
  assert(parseCsv('   \n  \n').length === 0, 'parseCsv: só whitespace → []')
  const curto = 'ano_agricola;uf;produto\n2023/24;RS;SOJA' // < 8 colunas
  assert(parseCsv(curto).length === 0, 'parseCsv: linha com poucas colunas ignorada')
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
