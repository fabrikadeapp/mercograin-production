/**
 * Tests para lib/cotacoes/integrada.ts
 * Run: npx tsx lib/cotacoes/integrada.test.ts
 */
import {
  compararTradings,
  resumoMercado,
  premioImplicitoUsdBu,
  precoFormadoBrlSc,
  type VisaoIntegrada,
} from './integrada'

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

// Base de mercado comum aos casos (soja).
const base: VisaoIntegrada = {
  grao: 'soja',
  cbotCentavosBu: 1320,
  cambioUsdBrl: 5.4,
  fobbingsUsdTon: -12,
  freteBrlSc: 0,
}

// ── 1. premioImplicitoUsdBu retorna 0 para preço <= 0 ───────────────────────
{
  assert(premioImplicitoUsdBu(base, 0) === 0, 'preço de balcão 0 → prêmio implícito 0')
  assert(premioImplicitoUsdBu(base, -50) === 0, 'preço de balcão negativo → prêmio implícito 0')
}

// ── 2. Fórmula da planilha PREMIOS confere com cálculo manual ───────────────
{
  // PRECO=160, CAMBIO=5,4, CBOT=1320¢ → 13,20/bu, FOBBINGS -12 → termo +12
  // usdTon = (160/5,4)*16,6667 + 12 = 29,6296*16,6667 + 12 = 493,827 + 12 = 505,827
  // premio = 505,827/36,74541 - 13,20 = 13,7657 - 13,20 = 0,5657
  const esperado = ((160 / 5.4) * 16.6667 + 12) / 36.74541 - 13.2
  const obtido = premioImplicitoUsdBu(base, 160)
  assert(approxEq(obtido, esperado, 1e-6), 'prêmio implícito = fórmula manual planilha', `${obtido} vs ${esperado}`)
  assert(approxEq(obtido, 0.5657, 1e-3), 'prêmio implícito ≈ 0,5657 US$/bu para R$160', `${obtido}`)
}

// ── 3. Maior preço de balcão → maior prêmio implícito (monotônico) ──────────
{
  const baixo = premioImplicitoUsdBu(base, 150)
  const alto = premioImplicitoUsdBu(base, 170)
  assert(alto > baixo, 'preço de balcão maior embute prêmio implícito maior', `${alto} > ${baixo}`)
}

// ── 4. precoFormadoBrlSc cresce com o prêmio informado ──────────────────────
{
  const p40 = precoFormadoBrlSc(base, 40)
  const p80 = precoFormadoBrlSc(base, 80)
  assert(p80 > p40, 'prêmio informado maior forma preço maior', `${p80} > ${p40}`)
}

// ── 5. compararTradings ordena pelo MELHOR preço formado ────────────────────
{
  const res = compararTradings(base, [
    { nome: 'CARGILL', premioCentavosBu: 40 },
    { nome: 'BUNGE', premioCentavosBu: 80 },
    { nome: 'ADM', premioCentavosBu: 60 },
  ])
  assert(res[0].nome === 'BUNGE', 'topo é a trading de maior prêmio (BUNGE)', res[0].nome)
  assert(
    res[0].precoFormadoBrlSc >= res[1].precoFormadoBrlSc &&
      res[1].precoFormadoBrlSc >= res[2].precoFormadoBrlSc,
    'linhas ordenadas decrescente por preço formado',
  )
  // Sem preço de balcão informado → prêmio implícito e spread nulos.
  assert(res[0].premioImplicitoUsdBu === null && res[0].spread === null, 'sem preço de balcão → implícito/spread null')
}

// ── 6. Spread = implícito − informado quando ambos existem ──────────────────
{
  // Informa prêmio 55¢ e preço de balcão 165 → spread = implícito(165) - 0,55
  const res = compararTradings(base, [
    { nome: 'LDC', premioCentavosBu: 55, precoBalcaoBrlSc: 165 },
  ])
  const linha = res[0]
  const implicito = premioImplicitoUsdBu(base, 165)
  assert(linha.premioImplicitoUsdBu != null && approxEq(linha.premioImplicitoUsdBu, implicito, 1e-9), 'implícito calculado para preço de balcão informado')
  assert(linha.spread != null && approxEq(linha.spread, implicito - 0.55, 1e-9), 'spread = implícito − informado(¢→US$)', `${linha.spread}`)
}

// ── 7. resumoMercado: melhor trading, prêmio médio, melhor spread ───────────
{
  const tradings = [
    { nome: 'COFCO', premioCentavosBu: 40, precoBalcaoBrlSc: 158 },
    { nome: 'AMAGGI', premioCentavosBu: 80, precoBalcaoBrlSc: 168 },
    { nome: 'OLAM', premioCentavosBu: 60 },
  ]
  const r = resumoMercado(base, tradings)
  assert(r.totalTradings === 3, 'resumo conta 3 tradings')
  assert(r.melhorTrading?.nome === 'AMAGGI', 'melhor trading por preço = AMAGGI', r.melhorTrading?.nome)
  // prêmio médio informado = (40+80+60)/3 = 60
  assert(r.premioMedioCentavosBu != null && approxEq(r.premioMedioCentavosBu, 60, 1e-9), 'prêmio médio informado = 60¢', `${r.premioMedioCentavosBu}`)
  // melhor spread só entre quem tem preço de balcão (COFCO, AMAGGI)
  const spreadCofco = premioImplicitoUsdBu(base, 158) - 0.4
  const spreadAmaggi = premioImplicitoUsdBu(base, 168) - 0.8
  const esperadoMelhor = Math.max(spreadCofco, spreadAmaggi)
  assert(r.melhorSpread != null && approxEq(r.melhorSpread, esperadoMelhor, 1e-9), 'melhor spread = max(COFCO, AMAGGI)', `${r.melhorSpread}`)
  assert(r.melhorSpreadTrading != null, 'melhor spread tem trading associada')
}

// ── 8. resumoMercado com lista vazia → tudo null/zero ───────────────────────
{
  const r = resumoMercado(base, [])
  assert(
    r.melhorTrading === null &&
      r.melhorPrecoBrlSc === null &&
      r.premioMedioCentavosBu === null &&
      r.melhorSpread === null &&
      r.totalTradings === 0,
    'lista vazia → resumo neutro',
  )
}

// ── 9. Round-trip aproximado entre as duas direções ─────────────────────────
{
  // Forma preço com frete 0 e FOBBINGS coerente, depois deriva prêmio implícito.
  // As constantes diferem levemente (36,74541 da planilha vs 36,7437 do simulador),
  // então conferimos proximidade, não igualdade exata.
  const semFrete: VisaoIntegrada = { ...base, freteBrlSc: 0 }
  const preco = precoFormadoBrlSc(semFrete, 55) // forma preço a partir de 55¢
  const implicito = premioImplicitoUsdBu(semFrete, preco) // volta para prêmio
  assert(approxEq(implicito, 0.55, 5e-3), 'round-trip prêmio→preço→prêmio ≈ 0,55 US$/bu', `${implicito}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
