/**
 * Tests para lib/usda/relatorio.ts
 * Run: npx tsx lib/usda/relatorio.test.ts
 */
import {
  calcularVariacao,
  montarLinha,
  montarRelatorio,
  relatorioExemplo,
  LIMIAR_FLAT_PCT,
  type DadosRelatorio,
} from './relatorio'

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

// ── calcularVariacao: up / down / flat ──────────────────────────────────────
{
  const up = calcularVariacao(110, 100)
  assert(up.seta === 'up' && approxEq(up.pct!, 10), 'variação up: +10%', JSON.stringify(up))

  const down = calcularVariacao(90, 100)
  assert(down.seta === 'down' && approxEq(down.pct!, -10), 'variação down: -10%', JSON.stringify(down))

  // variação menor que o limiar flat (0.02% < 0.05%)
  const flat = calcularVariacao(100.02, 100)
  assert(flat.seta === 'flat', 'variação abaixo do limiar é flat', JSON.stringify(flat))
}

// ── calcularVariacao: divisão por zero e null ───────────────────────────────
{
  const zero = calcularVariacao(100, 0)
  assert(zero.pct === null && zero.seta === 'flat', 'base zero → pct null, flat', JSON.stringify(zero))

  const nAtual = calcularVariacao(null, 100)
  assert(nAtual.pct === null && nAtual.seta === 'flat', 'atual null → pct null, flat', JSON.stringify(nAtual))

  const nBase = calcularVariacao(100, null)
  assert(nBase.pct === null && nBase.seta === 'flat', 'base null → pct null, flat', JSON.stringify(nBase))
}

// ── montarLinha: conversão ÷1000 e setas ────────────────────────────────────
{
  // 124883 mil-ton → 124.883 Mt; anterior 123200 → 123.2; safra 111100 → 111.1
  const linha = montarLinha('Estoques Finais', 124883, 123200, 111100)
  assert(approxEq(linha.atual!, 124.883), 'conversão ÷1000: 124883 → 124,883 Mt', `${linha.atual}`)
  assert(approxEq(linha.anterior!, 123.2), 'conversão anterior 123200 → 123,2 Mt', `${linha.anterior}`)
  assert(approxEq(linha.safraPassada!, 111.1), 'conversão safra 111100 → 111,1 Mt', `${linha.safraPassada}`)
  assert(linha.setaMensal === 'up', 'setaMensal up (124,9 > 123,2)', linha.setaMensal)
  assert(linha.setaAnual === 'up', 'setaAnual up (124,9 > 111,1)', linha.setaAnual)
  assert(linha.variacaoMensal !== null && linha.variacaoMensal > 0, 'variacaoMensal positiva', `${linha.variacaoMensal}`)
}

// ── montarLinha: setas down e null ──────────────────────────────────────────
{
  const linha = montarLinha('Estoques Finais', 8300, 9530, 9560)
  assert(linha.setaMensal === 'down', 'setaMensal down (8,3 < 9,53)', linha.setaMensal)
  assert(linha.setaAnual === 'down', 'setaAnual down (8,3 < 9,56)', linha.setaAnual)

  const nulo = montarLinha('Produção', null, 100, null)
  assert(nulo.atual === null && nulo.variacaoMensal === null && nulo.setaMensal === 'flat', 'linha com atual null', JSON.stringify(nulo))
}

// ── montarRelatorio: só soja, só mundo, só estoqueFinal ─────────────────────
{
  const dados: DadosRelatorio = {
    soja: { mundo: { estoqueFinal: { atualMt: 124883, anteriorMt: 123200, safraPassadaMt: 111100 } } },
    milho: { mundo: { estoqueFinal: { atualMt: 277800, anteriorMt: 275500, safraPassadaMt: 287900 } } },
  }
  const rel = montarRelatorio({
    graos: ['soja'],
    secoes: ['mundo'],
    metricas: ['estoqueFinal'],
    dados,
    geradoEm: '2026-06-11T00:00:00Z',
  })
  assert(rel.secoes.length === 1, 'só soja+mundo → 1 seção (milho excluído)', `${rel.secoes.length}`)
  assert(rel.secoes[0].grao === 'soja', 'seção é soja', rel.secoes[0].grao)
  assert(rel.secoes[0].linhas.length === 1, 'só estoqueFinal → 1 linha', `${rel.secoes[0].linhas.length}`)
  assert(rel.fonte === 'USDA', 'fonte USDA', rel.fonte)
  assert(rel.geradoEm === '2026-06-11T00:00:00Z', 'geradoEm carimbado pelo caller', rel.geradoEm)
}

// ── montarRelatorio: omite seção sem dados ──────────────────────────────────
{
  const dados: DadosRelatorio = {
    soja: { mundo: { producao: { atualMt: 426300, anteriorMt: 425100, safraPassadaMt: 394700 } } },
  }
  // pede eua também, mas não há dados → não deve criar seção eua
  const rel = montarRelatorio({
    graos: ['soja'],
    secoes: ['mundo', 'eua'],
    metricas: ['producao', 'estoqueFinal'],
    dados,
  })
  assert(rel.secoes.length === 1, 'seção sem dados (eua) é omitida', `${rel.secoes.length}`)
  assert(rel.secoes[0].linhas.length === 1, 'métrica sem dados (estoqueFinal) é omitida', `${rel.secoes[0].linhas.length}`)
}

// ── relatorioExemplo: estrutura completa e valor BIOND ──────────────────────
{
  const rel = relatorioExemplo('2026-06-11')
  assert(rel.secoes.length === 6, 'exemplo: 2 grãos × 3 seções = 6 seções', `${rel.secoes.length}`)
  const sojaMundo = rel.secoes.find((s) => s.titulo.includes('Soja') && s.titulo.includes('Mundo'))!
  const estoque = sojaMundo.linhas.find((l) => l.rotulo === 'Estoques Finais')!
  assert(approxEq(estoque.atual!, 124.883), 'exemplo soja/mundo estoque ≈ 124,9 Mt (BIOND)', `${estoque.atual}`)
  assert(rel.fonte === 'USDA' && rel.geradoEm === '2026-06-11', 'exemplo fonte/geradoEm', `${rel.fonte}/${rel.geradoEm}`)
}

// ── LIMIAR_FLAT_PCT exportado ───────────────────────────────────────────────
assert(LIMIAR_FLAT_PCT === 0.05, 'LIMIAR_FLAT_PCT = 0,05%', `${LIMIAR_FLAT_PCT}`)

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
