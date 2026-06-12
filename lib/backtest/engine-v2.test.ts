/**
 * Tests para lib/backtest/engine-v2.ts
 * Run: npx tsx lib/backtest/engine-v2.test.ts
 *
 * Sem data do sistema: todas as séries são sintéticas e passadas por parâmetro.
 */
import {
  powerset,
  gerarSinalV2,
  rodarBacktestV2,
  gridSearchWalkForward,
  FATORES_V2,
  type PontoSerieV2,
  type ContextoSinalV2,
} from './engine-v2'

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

function baseCtxV2(over: Partial<ContextoSinalV2>): ContextoSinalV2 {
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

/** Constrói uma série sintética. Função NOMEADA (não arrow genérica + bloco). */
function serieLinear(
  anoBase: number,
  meses: number,
  fnPreco: (i: number) => number,
  fnCbot: (i: number) => number,
  extra?: (i: number) => Partial<PontoSerieV2>,
): PontoSerieV2[] {
  const out: PontoSerieV2[] = []
  for (let i = 0; i < meses; i++) {
    const ano = anoBase + Math.floor(i / 12)
    const mesCal = (i % 12) + 1
    out.push({
      mes: `${ano}-${String(mesCal).padStart(2, '0')}`,
      precoFisico: fnPreco(i),
      cbot: fnCbot(i),
      cambio: 5,
      ...(extra ? extra(i) : {}),
    })
  }
  return out
}

// ── 1) powerset: 2^n - 1 (n=3) ──────────────────────────────────────────────
{
  const ps = powerset(['a', 'b', 'c'])
  assert(ps.length === 7, 'powerset(3) tem 2^3-1 = 7 subconjuntos', `${ps.length}`)
  assert(
    !ps.some((s) => s.length === 0),
    'powerset exclui o conjunto vazio',
    JSON.stringify(ps),
  )
  // contém os singletons e o conjunto completo
  assert(ps.some((s) => s.length === 3), 'inclui o conjunto completo')
  assert(ps.filter((s) => s.length === 1).length === 3, 'inclui os 3 singletons')
}

// ── 2) powerset: n=1 e n=6 ──────────────────────────────────────────────────
{
  assert(powerset(['x']).length === 1, 'powerset(1) = 1', `${powerset(['x']).length}`)
  assert(powerset([...FATORES_V2]).length === 63, 'powerset(6 fatores) = 63', `${powerset([...FATORES_V2]).length}`)
}

// ── 3) powerset: > 6 fatores lança ──────────────────────────────────────────
{
  let lancou = false
  try {
    powerset(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  } catch {
    lancou = true
  }
  assert(lancou, 'powerset com 7 fatores lança (explosão combinatória)')
}

// ── 4) gerarSinalV2: só preco_vs_media ativo → vender; outros ignorados ──────
{
  // Preço 20% acima da média (vender) MAS COT extremamente comprado também (que,
  // se ativo, reforçaria vender). Ativando SÓ preco_vs_media, COT é ignorado —
  // mas como ambos puxam pra baixo, validamos que só o fator ativo aparece.
  const s = gerarSinalV2(
    baseCtxV2({ precoFisico: 120, mediaMovel: 100, cotZScore: 2, carryPct: 0.05 }),
    new Set(['preco_vs_media']),
  )
  assert(s.recomendacao === 'vender', 'preço acima da média → vender', JSON.stringify(s))
  assert(s.fatores.length === 1, 'apenas 1 fator (os demais não estão em fatoresAtivos)', JSON.stringify(s.fatores))
  assert(s.fatores[0].nome === 'preco_vs_media', 'o fator é preco_vs_media', JSON.stringify(s.fatores))
}

// ── 5) gerarSinalV2: cot_extremo CONTRARIAN (comprado esticado → vender) ─────
{
  const s = gerarSinalV2(
    baseCtxV2({ precoFisico: 100, mediaMovel: 100, cotZScore: 2.5 }),
    new Set(['cot_extremo']),
  )
  assert(
    s.fatores.some((f) => f.nome === 'cot_extremo' && f.contribuicao < 0),
    'COT comprado esticado → contribuição negativa (contrarian)',
    JSON.stringify(s.fatores),
  )
  assert(s.recomendacao === 'vender', 'COT esticado isolado → vender', JSON.stringify(s))
  // o inverso: COT muito short → positivo (esperar)
  const s2 = gerarSinalV2(
    baseCtxV2({ precoFisico: 100, mediaMovel: 100, cotZScore: -2.5 }),
    new Set(['cot_extremo']),
  )
  assert(s2.recomendacao === 'esperar', 'COT muito short → esperar (reversão p/ cima)', JSON.stringify(s2))
}

// ── 6) gerarSinalV2: carry forte = baixista → vender; invertido = altista ────
{
  const forte = gerarSinalV2(
    baseCtxV2({ precoFisico: 100, mediaMovel: 100, carryPct: 0.05 }),
    new Set(['carry']),
  )
  assert(forte.recomendacao === 'vender', 'carry forte (bem suprido) → vender', JSON.stringify(forte))
  const invertido = gerarSinalV2(
    baseCtxV2({ precoFisico: 100, mediaMovel: 100, carryPct: -0.05 }),
    new Set(['carry']),
  )
  assert(invertido.recomendacao === 'esperar', 'carry invertido (aperto) → esperar', JSON.stringify(invertido))
}

// ── 7) gerarSinalV2: momentum (CBOT 3m) ─────────────────────────────────────
{
  // CBOT subiu de 1000 → 1100 em 3 meses (+10%) → momentum positivo → esperar.
  const s = gerarSinalV2(
    baseCtxV2({ precoFisico: 100, mediaMovel: 100, cbot: 1100, cbot3mAtras: 1000, cbotAnterior: null }),
    new Set(['momentum']),
  )
  assert(
    s.fatores.some((f) => f.nome === 'momentum' && f.contribuicao > 0),
    'CBOT subindo em 3m → momentum positivo',
    JSON.stringify(s.fatores),
  )
  assert(s.recomendacao === 'esperar', 'momentum positivo isolado → esperar', JSON.stringify(s))
}

// ── 8) gerarSinalV2: sazonal usa os padrões passados ────────────────────────
{
  // mês 3 com padrão -0.10 (retorno seguinte muito negativo) → vender.
  const padroes = { 3: -0.1, 8: 0.1 }
  const sBaixa = gerarSinalV2(
    baseCtxV2({ mes: '2024-03', mesCalendario: 3, padroesSazonais: padroes }),
    new Set(['sazonal']),
  )
  assert(sBaixa.recomendacao === 'vender', 'sazonal mês fraco → vender', JSON.stringify(sBaixa))
  const sAlta = gerarSinalV2(
    baseCtxV2({ mes: '2024-08', mesCalendario: 8, padroesSazonais: padroes }),
    new Set(['sazonal']),
  )
  assert(sAlta.recomendacao === 'esperar', 'sazonal mês forte → esperar', JSON.stringify(sAlta))
  // sem padroesSazonais → sazonal não contribui (nunca inventa)
  const sNeutro = gerarSinalV2(
    baseCtxV2({ mes: '2024-03', mesCalendario: 3 }),
    new Set(['sazonal']),
  )
  assert(sNeutro.fatores.length === 0, 'sazonal sem padrões → não contribui', JSON.stringify(sNeutro.fatores))
}

// ── 9) gerarSinalV2: fatoresAtivos vazio → segurar (score 0) ─────────────────
{
  const s = gerarSinalV2(
    baseCtxV2({ precoFisico: 200, mediaMovel: 100, cotZScore: 3, carryPct: 0.1 }),
    new Set<string>(),
  )
  assert(s.fatores.length === 0, 'nenhum fator ativo → sem contribuições', JSON.stringify(s.fatores))
  assert(s.score === 0 && s.recomendacao === 'segurar', 'score 0 → segurar', `${s.score}/${s.recomendacao}`)
}

// ── 10) rodarBacktestV2: preco_vs_media CONTRARIAN reverte picos → acerta ────
{
  // Série em "dente de serra" que reverte à média: quando o preço dispara ACIMA
  // da média (pico), o contrarian diz 'vender' e o preço de fato CAI no mês
  // seguinte (reversão). Validamos que o fator preco_vs_media acerta acima do acaso.
  const serie: PontoSerieV2[] = []
  // base 100; picos a cada 2 meses (sobe 12% depois volta), oscilando em torno da média.
  for (let i = 0; i < 20; i++) {
    const pico = i % 2 === 1 // meses ímpares são picos
    const preco = pico ? 112 : 100
    const ano = 2022 + Math.floor(i / 12)
    const mesCal = (i % 12) + 1
    serie.push({
      mes: `${ano}-${String(mesCal).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
    })
  }
  const r = rodarBacktestV2(serie, {
    horizonteMeses: 1,
    fatoresAtivos: new Set(['preco_vs_media']),
  })
  assert(r.totalSinais > 0, 'gerou sinais', `${r.totalSinais}`)
  // nos picos (acima da média) → vender; e o mês seguinte cai → acerta. >= 60% é robusto.
  assert(r.taxaAcerto >= 60, 'contrarian acerta as reversões dos picos', `${r.taxaAcerto}`)
  // porFator reporta apenas o fator ativo
  assert(r.porFator.length === 1 && r.porFator[0].nome === 'preco_vs_media', 'porFator só o ativo', JSON.stringify(r.porFator))
}

// ── 11) rodarBacktestV2: COT contrarian num mercado de queda → vender acerta ─
{
  // COT z-score sempre alto (comprado esticado) → contrarian 'vender'. Preço cai →
  // vender acerta sempre.
  const serie = serieLinear(
    2021,
    16,
    (i) => 150 * Math.pow(0.95, i),
    () => 1000,
    () => ({ cotZScore: 2.5 }),
  )
  const r = rodarBacktestV2(serie, {
    horizonteMeses: 1,
    fatoresAtivos: new Set(['cot_extremo']),
  })
  assert(r.detalhe.every((d) => d.rec === 'vender'), 'COT esticado → vender sempre', JSON.stringify(r.detalhe.map((d) => d.rec)))
  assert(r.taxaAcerto === 100, 'vender acerta 100% na queda contínua', `${r.taxaAcerto}`)
  assert(r.ganhoVsBaseline === 0, 'sinal == baseline (todo vender) → ganho 0', `${r.ganhoVsBaseline}`)
}

// ── 12) gridSearchWalkForward: escolhe a config certa quando um fator domina ─
{
  // Construímos uma série onde o MOMENTUM (CBOT 3m) é claramente preditivo e o
  // preco_vs_media NÃO. Em blocos longos de tendência: durante a ALTA o CBOT já
  // vem subindo há 3 meses (momentum positivo → 'esperar' → acerta a alta);
  // durante a BAIXA o CBOT já vem caindo (momentum negativo → 'vender' → acerta
  // a queda). Blocos de 6 meses dão ao momentum 3m tempo de "engatar" a tendência.
  const meses = 48
  const serie: PontoSerieV2[] = []
  let preco = 100
  let cbot = 1000
  for (let i = 0; i < meses; i++) {
    const fase = Math.floor(i / 6) % 2 // bloco de 6: 0 = alta, 1 = baixa
    const subindo = fase === 0
    const ano = 2018 + Math.floor(i / 12)
    const mesCal = (i % 12) + 1
    serie.push({
      mes: `${ano}-${String(mesCal).padStart(2, '0')}`,
      precoFisico: preco,
      cbot,
      cambio: 5,
    })
    // CBOT e preço movem-se JUNTOS na tendência (CBOT 3m captura o regime atual).
    const fator = subindo ? 1.03 : 0.97
    preco = preco * fator
    cbot = cbot * fator
  }

  const res = gridSearchWalkForward(serie, {
    horizontes: [1],
    combosFatores: [['momentum'], ['preco_vs_media'], ['momentum', 'preco_vs_media']],
    janelaTreino: 12,
  })
  assert(res.totalCombos > 0, 'grid produziu combos avaliados', `${res.totalCombos}`)
  assert(res.ranking.length === res.totalCombos, 'ranking cobre todos os combos válidos', `${res.ranking.length}/${res.totalCombos}`)
  // momentum deve estar na melhor config (sozinho ou combinado) — é o fator preditivo
  assert(
    res.melhor.fatores.includes('momentum'),
    'melhor config inclui o fator preditivo (momentum)',
    JSON.stringify(res.melhor),
  )
  // a métrica é OOS: a taxa deve estar em [0,100]
  assert(
    res.melhor.taxaAcertoOOS >= 0 && res.melhor.taxaAcertoOOS <= 100,
    'taxaAcertoOOS em [0,100]',
    `${res.melhor.taxaAcertoOOS}`,
  )
  // ranking ordenado desc por taxa OOS
  let ordenado = true
  for (let i = 1; i < res.ranking.length; i++) {
    if (res.ranking[i].taxaAcertoOOS > res.ranking[i - 1].taxaAcertoOOS + 1e-9) ordenado = false
  }
  assert(ordenado, 'ranking ordenado desc por taxaAcertoOOS', JSON.stringify(res.ranking))
}

// ── 13) gridSearchWalkForward: OOS != IN-sample (mede só o futuro do treino) ─
{
  // Série com REGIME que MUDA no meio: primeira metade sobe, segunda metade cai.
  // Um fator calibrado/medido in-sample na 1ª metade pareceria ótimo, mas o OOS
  // (2ª metade) revela comportamento diferente → taxa OOS != taxa in-sample.
  const serie: PontoSerieV2[] = []
  let preco = 100
  for (let i = 0; i < 36; i++) {
    const ano = 2015 + Math.floor(i / 12)
    const mesCal = (i % 12) + 1
    const subindo = i < 18
    serie.push({
      mes: `${ano}-${String(mesCal).padStart(2, '0')}`,
      precoFisico: preco,
      cbot: 1000,
      cambio: 5,
    })
    preco = subindo ? preco * 1.04 : preco * 0.96
  }

  const fatores = new Set(['preco_vs_media'])
  // IN-SAMPLE: roda o backtest V2 no DATASET INTEIRO (sem walk-forward).
  const inSample = rodarBacktestV2(serie, { horizonteMeses: 1, fatoresAtivos: fatores })
  // OOS: grid com janelaTreino=18 → testa SÓ a 2ª metade (regime de queda).
  const res = gridSearchWalkForward(serie, {
    horizontes: [1],
    combosFatores: [['preco_vs_media']],
    janelaTreino: 18,
  })
  assert(res.ranking.length === 1, 'grid avaliou a config única', `${res.ranking.length}`)
  const taxaOOS = res.melhor.taxaAcertoOOS
  // As métricas devem diferir porque medem janelas diferentes (regime distinto).
  assert(
    Math.abs(taxaOOS - inSample.taxaAcerto) > 1e-6,
    'taxa OOS difere da taxa in-sample (sem vazamento)',
    `oos=${taxaOOS} inSample=${inSample.taxaAcerto}`,
  )
}

// ── 14) gridSearchWalkForward: default usa powerset de FATORES_V2 (63 combos) ─
{
  const serie = serieLinear(
    2017,
    30,
    (i) => 100 + i, // alta linear suave
    (i) => 1000 + i * 5,
    (i) => ({ cotZScore: 0, carryPct: 0, mesCalendario: (i % 12) + 1 }),
  )
  const res = gridSearchWalkForward(serie, {
    horizontes: [1, 2],
    // combosFatores ausente → usa powerset(FATORES_V2) = 63 combos por horizonte
    janelaTreino: 10,
  })
  // 2 horizontes × 63 combos = até 126 configs (algumas podem ter 0 sinais e cair)
  assert(res.totalCombos > 0 && res.totalCombos <= 126, 'totalCombos coerente com powerset×horizontes', `${res.totalCombos}`)
  assert(res.melhor.horizonte === 1 || res.melhor.horizonte === 2, 'melhor horizonte no grid', `${res.melhor.horizonte}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
