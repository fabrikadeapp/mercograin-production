/**
 * Tests para lib/backtest/engine.ts
 * Run: npx tsx lib/backtest/engine.test.ts
 *
 * Sem data do sistema: todas as séries são sintéticas e passadas por parâmetro.
 */
import {
  gerarSinal,
  rodarBacktest,
  calibrarPesos,
  retornoDoSinal,
  sinalAcertou,
  FATORES,
  PESOS_PADRAO,
  LIMIAR_DECISAO,
  type PontoSerie,
  type ContextoSinal,
} from './engine'

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

function approxEq(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps
}

function baseCtx(over: Partial<ContextoSinal>): ContextoSinal {
  return {
    mes: '2024-01',
    precoFisico: 100,
    mediaMovel: 100,
    cbot: 1000,
    cbotAnterior: 1000,
    cambio: 5,
    ...over,
  }
}

// ── 1) gerarSinal: preço muito acima da média → vender ──────────────────────
{
  // preço 20% acima da média e nada mais → contribuição negativa forte → vender
  const s = gerarSinal(baseCtx({ precoFisico: 120, mediaMovel: 100, cbotAnterior: 1000 }))
  assert(s.recomendacao === 'vender', 'preço bem acima da média → vender', JSON.stringify(s))
  assert(s.score < 0, 'score negativo quando preço alto', `${s.score}`)
  assert(
    s.fatores.some((f) => f.nome === 'preco_vs_media' && f.contribuicao < 0),
    'fator preco_vs_media com contribuição negativa',
    JSON.stringify(s.fatores),
  )
}

// ── 2) gerarSinal: dólar projetado subindo forte → esperar ──────────────────
{
  // câmbio 5,00 e dólar projetado 5,40 (+8%) → positivo → esperar
  const s = gerarSinal(
    baseCtx({ precoFisico: 100, mediaMovel: 100, cambio: 5, dolarProj: 5.4 }),
  )
  assert(s.recomendacao === 'esperar', 'dólar projetado em alta → esperar', JSON.stringify(s))
  assert(
    s.fatores.some((f) => f.nome === 'dolar_proj' && f.contribuicao > 0),
    'fator dolar_proj positivo',
    JSON.stringify(s.fatores),
  )
}

// ── 3) gerarSinal: estoque USDA subindo (baixista) → vender ─────────────────
{
  const s = gerarSinal(
    baseCtx({
      precoFisico: 100,
      mediaMovel: 100,
      estoqueUsda: 130,
      estoqueUsdaAnterior: 120, // +8,3% estoque → baixista
    }),
  )
  assert(
    s.fatores.some((f) => f.nome === 'estoque_usda' && f.contribuicao < 0),
    'estoque subindo → fator estoque_usda negativo',
    JSON.stringify(s.fatores),
  )
  assert(s.recomendacao === 'vender', 'estoque subindo isolado → vender', JSON.stringify(s))
}

// ── 4) gerarSinal: tudo neutro (variações abaixo do limiar) → segurar ───────
{
  const s = gerarSinal(
    baseCtx({
      precoFisico: 100.5, // 0,5% sobre média → abaixo do limiar de relevância
      mediaMovel: 100,
      cbot: 1000,
      cbotAnterior: 1000,
      dolarProj: 5.0,
      cambio: 5.0,
      estoqueUsda: 120,
      estoqueUsdaAnterior: 120,
    }),
  )
  assert(s.fatores.length === 0, 'nenhum fator relevante', JSON.stringify(s.fatores))
  assert(approxEq(s.score, 0), 'score zero', `${s.score}`)
  assert(s.recomendacao === 'segurar', 'tudo neutro → segurar', s.recomendacao)
}

// ── 5) gerarSinal: CBOT em forte queda → vender ─────────────────────────────
{
  const s = gerarSinal(
    baseCtx({ precoFisico: 100, mediaMovel: 100, cbot: 900, cbotAnterior: 1000 }),
  )
  assert(
    s.fatores.some((f) => f.nome === 'cbot_tendencia' && f.contribuicao < 0),
    'CBOT caindo → fator negativo',
    JSON.stringify(s.fatores),
  )
  assert(s.recomendacao === 'vender', 'CBOT em queda → vender', JSON.stringify(s))
}

// ── 6) retornoDoSinal / sinalAcertou: convenção de acerto ───────────────────
{
  // vender acerta com queda (variação negativa); captura ret = -variacao
  assert(sinalAcertou('vender', -5) === true, 'vender acerta com queda')
  assert(sinalAcertou('vender', 5) === false, 'vender erra com alta')
  assert(sinalAcertou('esperar', 5) === true, 'esperar acerta com alta')
  assert(sinalAcertou('segurar', -5) === false, 'segurar erra com queda')
  assert(retornoDoSinal('vender', -5) === 5, 'vender captura +5 quando cai 5%')
  assert(retornoDoSinal('esperar', 5) === 5, 'esperar captura +5 quando sobe 5%')
}

// ── 7) rodarBacktest: estoque baixista (peso isolado) + preço cai → vender ──
{
  // Isolamos o sinal de estoque zerando os pesos dos demais fatores via opts.
  // Estoque sobe forte (baixista) → 'vender'; preço cai → 'vender' acerta.
  const serie: PontoSerie[] = []
  let preco = 200
  let estoque = 100
  for (let i = 0; i < 14; i++) {
    serie.push({
      mes: `2023-${String((i % 12) + 1).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
      estoqueUsda: estoque,
    })
    preco = preco * 0.95 // queda 5%/mês
    estoque = estoque * 1.1 // +10%/mês → baixista
  }
  // pesos: só estoque conta → recomendação puramente do estoque.
  const r = rodarBacktest(serie, {
    horizonteMeses: 1,
    pesos: { preco_vs_media: 0, dolar_proj: 0, cbot_tendencia: 0, estoque_usda: 1 },
  })
  assert(r.totalSinais > 0, 'gerou sinais', `${r.totalSinais}`)
  // 1º mês não tem estoque anterior → 'segurar' (sem fator); demais → 'vender'.
  const semPrimeiro = r.detalhe.slice(1)
  assert(
    semPrimeiro.every((d) => d.rec === 'vender'),
    'todos vender após 1º mês (estoque baixista isolado)',
    JSON.stringify(r.detalhe.map((d) => d.rec)),
  )
  // queda contínua → 'vender' acerta sempre; 'segurar' do 1º mês erra na queda.
  assert(r.taxaAcerto >= 92, 'taxa de acerto alta (queda + vender)', `${r.taxaAcerto}`)
}

// ── 8) rodarBacktest: vender == baseline → ganho 0 ──────────────────────────
{
  // Todos 'vender' (estoque isolado) num mercado de queda → coincide com o
  // baseline 'vender todo mês' → ganho vs baseline = 0.
  const serie: PontoSerie[] = []
  let preco = 200
  let estoque = 100
  for (let i = 0; i < 12; i++) {
    serie.push({
      mes: `2022-${String((i % 12) + 1).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
      estoqueUsda: estoque,
    })
    preco = preco * 0.97
    estoque = estoque * 1.1
  }
  const r = rodarBacktest(serie, {
    horizonteMeses: 1,
    pesos: { preco_vs_media: 0, dolar_proj: 0, cbot_tendencia: 0, estoque_usda: 1 },
  })
  // 1º mês 'segurar' (sem estoque anterior); demais 'vender'. Onde o sinal é
  // 'vender' ele coincide com o baseline → contribuição 0 ao ganho. O único
  // desvio é o 1º mês (segurar). Validamos que a partir do 2º mês todos vendem
  // e que esses meses têm ganho idêntico ao baseline (diferença vem só do 1º).
  const aposPrimeiro = r.detalhe.slice(1)
  assert(aposPrimeiro.every((d) => d.rec === 'vender'), 'todos vender após 1º mês (estoque isolado)', JSON.stringify(r.detalhe.map((d) => d.rec)))
  // ganho ≈ apenas o efeito do 1º mês 'segurar' (pequeno), nunca positivo.
  assert(r.ganhoVsBaseline <= 0, 'ganho vs baseline ≤ 0 (sinal ⊆ vender)', `${r.ganhoVsBaseline}`)
  assert(r.retornoMedioSinal > 0, 'retorno do sinal positivo (vendeu antes da queda)', `${r.retornoMedioSinal}`)
}

// ── 9) rodarBacktest: dólar proj alto domina + preço sobe → esperar bate ────
{
  // Para isolar dolar_proj, mantemos o preço subindo DEVAGAR (1%/mês) — assim
  // o desvio sobre a média móvel de 6 meses fica < 2% (preco_vs_media neutro),
  // e o dólar projetado +8% sustenta a recomendação 'esperar'.
  const serie: PontoSerie[] = []
  let preco = 100
  for (let i = 0; i < 14; i++) {
    serie.push({
      mes: `2021-${String((i % 12) + 1).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
      dolarProj: 5.4, // +8% sustenta preço → positivo (esperar)
    })
    preco = preco * 1.01 // alta suave → preço ~ média móvel
  }
  const r = rodarBacktest(serie, { horizonteMeses: 1 })
  assert(
    r.detalhe.every((d) => d.rec === 'esperar'),
    'todos esperar (dólar proj alto domina)',
    JSON.stringify(r.detalhe.map((d) => d.rec)),
  )
  assert(approxEq(r.taxaAcerto, 100), 'esperar + preço subindo = 100% acerto', `${r.taxaAcerto}`)
  // baseline (vender todo mês) erra sempre num mercado de alta → retorno negativo
  assert(r.retornoBaseline < 0, 'baseline negativo em mercado de alta', `${r.retornoBaseline}`)
  assert(r.ganhoVsBaseline > 0, 'ganho vs baseline positivo', `${r.ganhoVsBaseline}`)
}

// ── 10) rodarBacktest: atribuição por fator coerente ────────────────────────
{
  // dólar projetado alto (positivo, aposta em alta) num mercado de alta → o
  // fator dolar_proj deve ter alta taxa de acerto.
  const serie: PontoSerie[] = []
  let preco = 100
  for (let i = 0; i < 12; i++) {
    serie.push({
      mes: `2020-${String(i + 1).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
      dolarProj: 5.4,
    })
    preco = preco * 1.03
  }
  const r = rodarBacktest(serie, { horizonteMeses: 1 })
  const fDolar = r.porFator.find((f) => f.nome === 'dolar_proj')!
  assert(fDolar.total > 0, 'fator dolar_proj votou', `${fDolar.total}`)
  assert(approxEq(fDolar.taxaAcerto, 100), 'dolar_proj acertou 100% em alta', `${fDolar.taxaAcerto}`)
  // todos os fatores canônicos presentes na atribuição (mesmo com total 0)
  assert(r.porFator.length === FATORES.length, 'porFator cobre todos os fatores', `${r.porFator.length}`)
}

// ── 11) rodarBacktest: horizonte respeita corte (não vaza futuro) ───────────
{
  const serie: PontoSerie[] = []
  for (let i = 0; i < 6; i++) {
    serie.push({
      mes: `2019-${String(i + 1).padStart(2, '0')}`,
      precoFisico: 100 + i,
      cbot: 1000,
      cambio: 5,
    })
  }
  const r = rodarBacktest(serie, { horizonteMeses: 3 })
  // com 6 pontos e H=3, só há 3 meses com futuro (i=0,1,2)
  assert(r.totalSinais === 3, 'totalSinais = len - H', `${r.totalSinais}`)
  // último detalhe compara mês i=2 (2019-03) com i=5 (2019-06)
  assert(r.detalhe[r.detalhe.length - 1].precoFuturo === 105, 'preço futuro correto (H=3)', `${r.detalhe[2].precoFuturo}`)
}

// ── 12) calibrarPesos: retorna combinação coerente e melhora ou iguala ──────
{
  // Mercado de alta sustentado: a calibração deve achar pesos que favorecem
  // 'esperar' (ex.: peso alto em dolar_proj/cbot) e taxa de acerto alta.
  const serie: PontoSerie[] = []
  let preco = 100
  for (let i = 0; i < 18; i++) {
    serie.push({
      mes: `2018-${String((i % 12) + 1).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000 + i * 10, // CBOT subindo (positivo)
      cambio: 5,
      dolarProj: 5.4,
    })
    preco = preco * 1.03
  }
  const cal = calibrarPesos(serie, [1, 2, 3])
  assert(
    FATORES.every((f) => typeof cal.pesos[f] === 'number'),
    'pesos calibrados cobrem todos os fatores',
    JSON.stringify(cal.pesos),
  )
  assert([1, 2, 3].includes(cal.melhorHorizonte), 'melhorHorizonte dentro do grid', `${cal.melhorHorizonte}`)
  assert(cal.taxaAcertoCalibrada >= 0 && cal.taxaAcertoCalibrada <= 100, 'taxa calibrada em [0,100]', `${cal.taxaAcertoCalibrada}`)
  // num mercado de alta consistente, a melhor taxa deve ser alta
  assert(cal.taxaAcertoCalibrada >= 90, 'calibração acha taxa alta em mercado de alta', `${cal.taxaAcertoCalibrada}`)
  // calibração nunca pior que pesos padrão
  const baseline = rodarBacktest(serie, { horizonteMeses: cal.melhorHorizonte, pesos: PESOS_PADRAO })
  assert(
    cal.taxaAcertoCalibrada >= baseline.taxaAcerto - 1e-9,
    'calibração >= taxa com pesos padrão',
    `cal=${cal.taxaAcertoCalibrada} base=${baseline.taxaAcerto}`,
  )
}

// ── 13) sanidade: LIMIAR_DECISAO governa banda morta → segurar ──────────────
{
  // score exatamente entre -LIMIAR e +LIMIAR → segurar
  const s = gerarSinal(
    baseCtx({ precoFisico: 103, mediaMovel: 100, cbotAnterior: 1000 }),
  )
  // 3% sobre média → direcao = -0.03/0.1 = -0.3 → |score| 0.3 < LIMIAR 0.5
  assert(Math.abs(s.score) < LIMIAR_DECISAO, 'score na banda morta', `${s.score}`)
  assert(s.recomendacao === 'segurar', 'score pequeno → segurar', s.recomendacao)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
