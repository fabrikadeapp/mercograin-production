/**
 * Testes da Calculadora de Preço Líquido.
 *
 * Executar standalone:
 *   npx ts-node lib/calculo/preco-liquido.test.ts
 */
import {
  calcularPrecoLiquido,
  inputVazio,
  CLASSIFICACAO_PADRAO,
  FUNRURAL_ALIQUOTA,
  scParaTonelada,
  toneladaParaSc,
} from './preco-liquido'

type Result = { name: string; passed: boolean; error?: string }
const results: Result[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: (e as Error).message })
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps
}

// ---------- Cálculo básico: frete + comissão ----------
test('calculo basico: frete + comissao', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 145
  i.quantidadeSc = 1000
  i.frete = { ativo: true, valor: { valorPorSc: 5 } }
  i.comissao = { ativo: true, valor: { percentual: 1.5 } }

  const r = calcularPrecoLiquido(i)
  assert(r.brutoTotal === 145000, `bruto esperado 145000, obtido ${r.brutoTotal}`)
  // Frete -5000, Comissao -2175 (1.5% de 145000)
  const esperado = 145000 - 5000 - 145000 * 0.015
  assert(approx(r.liquidoTotal, esperado), `liquido esperado ${esperado}, obtido ${r.liquidoTotal}`)
  assert(r.linhas.length === 2, `2 linhas esperadas, obtido ${r.linhas.length}`)
})

// ---------- FUNRURAL só PF ----------
test('FUNRURAL aplica 1.3% sobre bruto', () => {
  const i = inputVazio('soja', true)
  i.precoBrutoSc = 100
  i.quantidadeSc = 500
  i.funrural = { ativo: true, valor: {} }

  const r = calcularPrecoLiquido(i)
  const desconto = 100 * 500 * FUNRURAL_ALIQUOTA
  assert(approx(r.liquidoTotal, 50000 - desconto), `funrural errado: ${r.liquidoTotal}`)
})

test('FUNRURAL desativado nao aplica', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 100
  i.quantidadeSc = 500
  i.funrural = { ativo: false, valor: {} }
  const r = calcularPrecoLiquido(i)
  assert(r.liquidoTotal === 50000, `liquido deveria ser 50000, obtido ${r.liquidoTotal}`)
  assert(r.linhas.length === 0, 'nao deveria ter linhas')
})

// ---------- Classificação: deságio ----------
test('classificacao desagio (umidade alta + impureza alta)', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 100
  i.quantidadeSc = 1000
  // padrao soja: 14% umid / 1% imp; informo 15% / 2% => -1 -1 = -2%
  i.classificacao = { ativo: true, valor: { umidade: 15, impureza: 2 } }
  const r = calcularPrecoLiquido(i)
  assert(approx(r.liquidoTotal, 100000 * 0.98), `desagio errado: ${r.liquidoTotal}`)
  assert(r.linhas[0].valor < 0, 'linha de classificacao deveria ser negativa')
})

test('classificacao agio (umidade baixa)', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 100
  i.quantidadeSc = 1000
  // 13% / 1% => -(-1 + 0) = +1%
  i.classificacao = { ativo: true, valor: { umidade: 13, impureza: 1 } }
  const r = calcularPrecoLiquido(i)
  assert(approx(r.liquidoTotal, 101000), `agio errado: ${r.liquidoTotal}`)
  assert(r.linhas[0].valor > 0, 'linha deveria ser positiva (agio)')
})

test('classificacao no padrao = zero', () => {
  const i = inputVazio('milho', false)
  i.precoBrutoSc = 80
  i.quantidadeSc = 100
  const padrao = CLASSIFICACAO_PADRAO.milho
  i.classificacao = {
    ativo: true,
    valor: { umidade: padrao.umidadePadrao, impureza: padrao.impurezaPadrao },
  }
  const r = calcularPrecoLiquido(i)
  assert(r.liquidoTotal === 8000, `deveria ser igual ao bruto: ${r.liquidoTotal}`)
})

// ---------- Todos descontos juntos ----------
test('todos descontos ativos', () => {
  const i = inputVazio('soja', true)
  i.precoBrutoSc = 145
  i.quantidadeSc = 1000
  i.frete = { ativo: true, valor: { valorPorSc: 4 } }
  i.comissao = { ativo: true, valor: { percentual: 1.5 } }
  i.funrural = { ativo: true, valor: {} }
  i.classificacao = { ativo: true, valor: { umidade: 14, impureza: 1 } } // padrao = 0
  i.armazenagem = { ativo: true, valor: { valorPorScMes: 0.5, meses: 2 } }
  i.icms = { ativo: true, valor: { percentual: 1.8 } }

  const bruto = 145000
  const esperado =
    bruto -
    4 * 1000 - // frete
    bruto * 0.015 - // comissao
    bruto * 0.013 - // funrural
    0.5 * 2 * 1000 - // armazenagem
    bruto * 0.018 // icms

  const r = calcularPrecoLiquido(i)
  assert(approx(r.liquidoTotal, esperado), `liquido esperado ${esperado.toFixed(2)}, obtido ${r.liquidoTotal.toFixed(2)}`)
  assert(r.linhas.length === 6, `6 linhas, obtido ${r.linhas.length}`)
  assert(r.percentualDescontoEfetivo > 0, 'desconto efetivo deveria ser > 0')
})

// ---------- Toggle ativo/inativo ----------
test('toggle desativado nao gera linha', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 100
  i.quantidadeSc = 100
  i.frete = { ativo: false, valor: { valorPorSc: 100 } } // valor alto, mas inativo
  const r = calcularPrecoLiquido(i)
  assert(r.linhas.length === 0, 'desativado nao deveria gerar linha')
  assert(r.liquidoTotal === 10000, 'liquido = bruto')
})

// ---------- Liquido por saca ----------
test('liquidoPorSc calculado corretamente', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 150
  i.quantidadeSc = 500
  i.comissao = { ativo: true, valor: { percentual: 2 } }
  const r = calcularPrecoLiquido(i)
  assert(approx(r.liquidoPorSc, 150 * 0.98), `liquidoPorSc errado: ${r.liquidoPorSc}`)
})

// ---------- ICMS = 0 nao gera linha mesmo ativo ----------
test('ICMS 0% ativo nao gera linha', () => {
  const i = inputVazio('soja', false)
  i.precoBrutoSc = 100
  i.quantidadeSc = 100
  i.icms = { ativo: true, valor: { percentual: 0 } }
  const r = calcularPrecoLiquido(i)
  assert(r.linhas.length === 0, 'ICMS 0 nao deveria gerar linha')
})

// ---------- Conversoes ----------
test('conversao saca <-> tonelada', () => {
  assert(approx(scParaTonelada(1000), 60), 'sc->t: 1000sc = 60t')
  assert(approx(toneladaParaSc(60), 1000), 't->sc: 60t = 1000sc')
})

// Run + report
let passed = 0
let failed = 0
results.forEach((r) => {
  if (r.passed) {
    console.log(`PASS ${r.name}`)
    passed++
  } else {
    console.log(`FAIL ${r.name}: ${r.error}`)
    failed++
  }
})
console.log(`\n${passed} passed, ${failed} failed`)

if (typeof process !== 'undefined') {
  process.exit(failed === 0 ? 0 : 1)
}
