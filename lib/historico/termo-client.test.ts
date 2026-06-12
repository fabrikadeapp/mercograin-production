/**
 * Tests para lib/historico/termo-client.ts (funções PURAS).
 * Run: npx tsx lib/historico/termo-client.test.ts
 *
 * Sem rede: testa apenas classificarCarry e carrySazonalEstimado.
 */
import { classificarCarry, carrySazonalEstimado } from './termo-client'

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

// ── classificarCarry ─────────────────────────────────────────────────────────
{
  assert(classificarCarry(0.05) === 'forte_carry', 'carry +5% → forte_carry', classificarCarry(0.05))
  assert(classificarCarry(0.021) === 'forte_carry', 'carry +2,1% (acima do limiar) → forte_carry', classificarCarry(0.021))
  assert(classificarCarry(0.02) === 'leve_carry', 'carry +2% (no limiar) → leve_carry', classificarCarry(0.02))
  assert(classificarCarry(0.005) === 'leve_carry', 'carry +0,5% → leve_carry', classificarCarry(0.005))
  assert(classificarCarry(0) === 'leve_carry', 'carry 0 → leve_carry', classificarCarry(0))
  assert(classificarCarry(-0.001) === 'invertido', 'carry levemente negativo → invertido', classificarCarry(-0.001))
  assert(classificarCarry(-0.03) === 'invertido', 'carry -3% (backwardation) → invertido', classificarCarry(-0.03))
  // robustez: não-finito não lança e cai no neutro
  assert(classificarCarry(NaN) === 'leve_carry', 'NaN → leve_carry (sem lançar)', classificarCarry(NaN))
}

// ── carrySazonalEstimado ─────────────────────────────────────────────────────
{
  // Determinístico e em fração razoável.
  for (const grao of ['soja', 'milho'] as const) {
    for (let m = 1; m <= 12; m++) {
      const v = carrySazonalEstimado(m, grao)
      assert(Number.isFinite(v), `${grao} mês ${m} é finito`, `${v}`)
      assert(Math.abs(v) < 0.1, `${grao} mês ${m} dentro de ±10%`, `${v}`)
    }
  }

  // Padrão sazonal: colheita US (outubro) tem carry MAIOR que entressafra (julho).
  for (const grao of ['soja', 'milho'] as const) {
    const colheita = carrySazonalEstimado(10, grao) // outubro
    const entressafra = carrySazonalEstimado(7, grao) // julho
    assert(colheita > entressafra, `${grao}: colheita (out) > entressafra (jul)`, `out=${colheita} jul=${entressafra}`)
    assert(colheita > 0, `${grao}: colheita tem carry positivo (largo)`, `${colheita}`)
    assert(entressafra < 0, `${grao}: entressafra tem carry invertido`, `${entressafra}`)
  }

  // Integração com classificarCarry: pico de colheita classifica como forte_carry.
  assert(classificarCarry(carrySazonalEstimado(10, 'milho')) === 'forte_carry', 'milho outubro → forte_carry via classificador', `${carrySazonalEstimado(10, 'milho')}`)
  // Entressafra classifica como invertido.
  assert(classificarCarry(carrySazonalEstimado(7, 'soja')) === 'invertido', 'soja julho → invertido via classificador', `${carrySazonalEstimado(7, 'soja')}`)

  // Determinismo: mesma entrada, mesma saída.
  assert(carrySazonalEstimado(3, 'soja') === carrySazonalEstimado(3, 'soja'), 'determinístico', '')

  // Sanitização de mês fora do intervalo (não lança, normaliza).
  assert(carrySazonalEstimado(13, 'soja') === carrySazonalEstimado(1, 'soja'), 'mês 13 normaliza para janeiro', '')
  assert(carrySazonalEstimado(0, 'soja') === carrySazonalEstimado(12, 'soja'), 'mês 0 normaliza para dezembro', '')
  assert(Number.isFinite(carrySazonalEstimado(NaN, 'soja')), 'mês NaN não lança e retorna finito', '')
}

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
