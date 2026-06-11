/**
 * Tests para lib/cotacoes/premios.ts
 * Run: npx tsx lib/cotacoes/premios.test.ts
 *
 * Valida contra valores reais da Planilha Prêmios.
 */
import {
  calcularPremioImplicito,
  calcularGradePremios,
  tradingsPremiosDefault,
  mesesDefault,
  TRADINGS_PADRAO,
  type MesVencimento,
  type TradingPremios,
} from './premios'

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

// ── Prêmio implícito vs planilha real ───────────────────────────────────────
{
  const ldc = calcularPremioImplicito({
    precoBalcaoBrlSc: 132,
    cambioUsdBrl: 5.1826,
    chicagoUsdBu: 11.2225,
  })
  assert(approxEq(ldc, 0.6565, 1e-3), 'LDC 132 / 5,1826 / 11,2225 → ≈ 0,6565', `${ldc}`)

  const cargill = calcularPremioImplicito({
    precoBalcaoBrlSc: 132.3,
    cambioUsdBrl: 5.1826,
    chicagoUsdBu: 11.2225,
  })
  assert(approxEq(cargill, 0.6827, 1e-3), 'CARGILL 132,3 / 5,1826 / 11,2225 → ≈ 0,6827', `${cargill}`)
}

// ── Preço <= 0 retorna 0 ────────────────────────────────────────────────────
{
  const zero = calcularPremioImplicito({ precoBalcaoBrlSc: 0, cambioUsdBrl: 5.1826, chicagoUsdBu: 11.2225 })
  assert(zero === 0, 'preço 0 → prêmio 0', `${zero}`)

  const neg = calcularPremioImplicito({ precoBalcaoBrlSc: -10, cambioUsdBrl: 5.1826, chicagoUsdBu: 11.2225 })
  assert(neg === 0, 'preço negativo → prêmio 0', `${neg}`)
}

// ── Câmbio inválido → 0 (sem divisão por zero) ──────────────────────────────
{
  const r = calcularPremioImplicito({ precoBalcaoBrlSc: 132, cambioUsdBrl: 0, chicagoUsdBu: 11.2225 })
  assert(r === 0, 'câmbio 0 → prêmio 0 (sem divisão por zero)', `${r}`)
}

// ── Override de FOBBINGS e fator ────────────────────────────────────────────
{
  const padrao = calcularPremioImplicito({ precoBalcaoBrlSc: 132, cambioUsdBrl: 5.1826, chicagoUsdBu: 11.2225 })
  const semFobbings = calcularPremioImplicito({
    precoBalcaoBrlSc: 132,
    cambioUsdBrl: 5.1826,
    chicagoUsdBu: 11.2225,
    fobbingsUsdTon: 0,
  })
  assert(semFobbings < padrao, 'FOBBINGS 0 reduz o prêmio vs padrão 12', `${semFobbings} < ${padrao}`)
}

// ── Grade 2 tradings × 3 meses: shape correto ───────────────────────────────
{
  const meses: MesVencimento[] = [
    { label: 'Mês 1', cambio: 5.1826, chicagoUsdBu: 11.2225 },
    { label: 'Mês 2', cambio: 5.2, chicagoUsdBu: 11.3 },
    { label: 'Mês 3', cambio: 5.25, chicagoUsdBu: 11.4 },
  ]
  const tradings: TradingPremios[] = [
    { nome: 'LDC', precosPorMes: [132, 0, null] },
    { nome: 'CARGILL', precosPorMes: [132.3, 133, 134] },
  ]
  const grade = calcularGradePremios(tradings, meses)

  assert(grade.length === 2, 'grade: 2 linhas (tradings)', `${grade.length}`)
  assert(grade[0].premios.length === 3, 'grade: 3 colunas (meses)', `${grade[0].premios.length}`)
  assert(grade[0].nome === 'LDC' && grade[1].nome === 'CARGILL', 'grade: nomes preservados na ordem')
  assert(approxEq(grade[0].premios[0] as number, 0.6565, 1e-3), 'grade[LDC][mês1] ≈ 0,6565', `${grade[0].premios[0]}`)
  assert(grade[0].premios[1] === null, 'grade: preço 0 → célula null', `${grade[0].premios[1]}`)
  assert(grade[0].premios[2] === null, 'grade: preço null → célula null', `${grade[0].premios[2]}`)
  assert(grade[1].premios.every((p) => typeof p === 'number'), 'grade[CARGILL]: todas as células numéricas')
}

// ── tradingsPremiosDefault ──────────────────────────────────────────────────
{
  const t = tradingsPremiosDefault(3)
  assert(t.length === TRADINGS_PADRAO.length, 'tradingsPremiosDefault: 9 tradings', `${t.length}`)
  assert(t[0].nome === 'COFCO' && t[t.length - 1].nome === 'CARGILL', 'tradingsPremiosDefault: ordem COFCO..CARGILL')
  assert(t[0].precosPorMes.length === 3 && t[0].precosPorMes.every((p) => p === null), 'tradingsPremiosDefault: preços vazios (null) por mês')
}

// ── mesesDefault sem data base → rótulos genéricos ──────────────────────────
{
  const m = mesesDefault(undefined, 4)
  assert(m.length === 4, 'mesesDefault(qtd=4): 4 meses', `${m.length}`)
  assert(m[0].label === 'Mês 1' && m[3].label === 'Mês 4', 'mesesDefault sem data: rótulos genéricos Mês 1..N')
  assert(m.every((x) => x.cambio === 0 && x.chicagoUsdBu === 0), 'mesesDefault: câmbio e chicago zerados')
}

// ── mesesDefault com data base → rótulos Mmm/AA e virada de ano ──────────────
{
  const m = mesesDefault('2026-11-15', 4)
  assert(m[0].label === 'Nov/26', 'mesesDefault 2026-11: primeiro mês Nov/26', m[0].label)
  assert(m[1].label === 'Dez/26', 'mesesDefault: segundo mês Dez/26', m[1].label)
  assert(m[2].label === 'Jan/27', 'mesesDefault: vira o ano → Jan/27', m[2].label)
  assert(m[3].label === 'Fev/27', 'mesesDefault: Fev/27', m[3].label)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
