/**
 * Tests para lib/historico/series-client.ts (funções PURAS, sem rede).
 * Run: npx tsx lib/historico/series-client.test.ts
 */
import { alinharPorMes, parseValData, IPEA_CODES, type PontoMensal } from './series-client'

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

// ── 1) parseValData: extrai ano/mes do VALDATA com offset de fuso ────────────
{
  // O offset -03:00 NÃO pode empurrar o dia 01 p/ o mês anterior.
  assert(
    JSON.stringify(parseValData('2026-05-01T00:00:00-03:00')) === JSON.stringify({ ano: 2026, mes: 5 }),
    'parseValData maio/2026 com offset -03:00',
  )
  assert(
    JSON.stringify(parseValData('1990-01-01T00:00:00-02:00')) === JSON.stringify({ ano: 1990, mes: 1 }),
    'parseValData janeiro/1990 com offset -02:00',
  )
  assert(
    JSON.stringify(parseValData('1993-12-01T00:00:00-03:00')) === JSON.stringify({ ano: 1993, mes: 12 }),
    'parseValData dezembro (mês 12)',
  )
  assert(parseValData('lixo') === null, 'parseValData string inválida → null')
  assert(parseValData('2026-13-01T00:00:00Z') === null, 'parseValData mês 13 → null')
  // @ts-expect-error — entrada não-string deve retornar null sem lançar
  assert(parseValData(undefined) === null, 'parseValData undefined → null')
}

// ── 2) alinharPorMes: junta séries por (ano,mes), null onde falta ────────────
{
  const fisico: PontoMensal[] = [
    { ano: 2024, mes: 1, valor: 110 },
    { ano: 2024, mes: 2, valor: 112 },
    { ano: 2024, mes: 3, valor: 108 },
  ]
  const cbot: PontoMensal[] = [
    { ano: 2024, mes: 2, valor: 1200 },
    { ano: 2024, mes: 3, valor: 1190 },
    { ano: 2024, mes: 4, valor: 1180 }, // mês só na 2ª série
  ]
  const t = alinharPorMes(fisico, cbot)

  assert(t.length === 4, 'união de 4 meses distintos (jan..abr)', `${t.length}`)
  assert(
    t[0].ano === 2024 && t[0].mes === 1 && t[3].mes === 4,
    'resultado ascendente jan→abr',
    JSON.stringify(t.map((l) => l.mes)),
  )
  // jan: só físico
  assert(
    t[0].valores[0] === 110 && t[0].valores[1] === null,
    'jan presente só na série físico',
    JSON.stringify(t[0].valores),
  )
  // fev: ambas
  assert(
    t[1].valores[0] === 112 && t[1].valores[1] === 1200,
    'fev presente nas duas séries',
    JSON.stringify(t[1].valores),
  )
  // abr: só cbot
  assert(
    t[3].valores[0] === null && t[3].valores[1] === 1180,
    'abr presente só na série cbot',
    JSON.stringify(t[3].valores),
  )
}

// ── 3) alinharPorMes: ordena cross-ano e ponto duplicado fica com o último ───
{
  const a: PontoMensal[] = [
    { ano: 2025, mes: 1, valor: 5 },
    { ano: 2024, mes: 12, valor: 4 },
    { ano: 2024, mes: 12, valor: 9 }, // duplicado → vence o último
  ]
  const t = alinharPorMes(a)
  assert(
    t.length === 2 && t[0].ano === 2024 && t[0].mes === 12 && t[1].ano === 2025,
    'ordena dez/2024 antes de jan/2025',
    JSON.stringify(t.map((l) => `${l.ano}-${l.mes}`)),
  )
  assert(t[0].valores[0] === 9, 'duplicado mantém o último valor (9)', `${t[0].valores[0]}`)
}

// ── 4) alinharPorMes: sem séries / séries vazias → tabela vazia ──────────────
{
  assert(alinharPorMes().length === 0, 'nenhuma série → []')
  assert(alinharPorMes([], []).length === 0, 'séries vazias → []')
}

// ── 5) IPEA_CODES: códigos corretos das séries gabarito ──────────────────────
{
  assert(IPEA_CODES.soja === 'DERAL12_PRSO12', 'código IPEA soja')
  assert(IPEA_CODES.milho === 'DERAL12_PRMI12', 'código IPEA milho')
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
