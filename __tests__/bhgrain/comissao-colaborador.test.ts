import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularComissaoColaborador,
  normalizarFaixas,
  type RegraComissao,
} from '../../lib/comissao/colaborador'

// ── percentual ──────────────────────────────────────────────
test('percentual: 1,5% sobre 200k = 3.000', () => {
  const r: RegraComissao = { tipo: 'percentual', pct: 1.5 }
  assert.equal(calcularComissaoColaborador(r, 200_000).valorComissao, 3000)
})

test('percentual: vendido 0 = 0', () => {
  const r: RegraComissao = { tipo: 'percentual', pct: 2 }
  assert.equal(calcularComissaoColaborador(r, 0).valorComissao, 0)
})

// ── fixo ────────────────────────────────────────────────────
test('fixo por período: 2.000 independente do vendido', () => {
  const r: RegraComissao = { tipo: 'fixo', valorFixo: 2000, baseFixo: 'periodo' }
  assert.equal(calcularComissaoColaborador(r, 999_999).valorComissao, 2000)
})

test('fixo por negócio: 500 × 4 = 2.000', () => {
  const r: RegraComissao = { tipo: 'fixo', valorFixo: 500, baseFixo: 'negocio' }
  assert.equal(calcularComissaoColaborador(r, 100_000, 4).valorComissao, 2000)
})

// ── piso + % ────────────────────────────────────────────────
test('piso+%: piso vence quando % é menor', () => {
  // piso 1.500 vs 1% de 100k = 1.000 → ganha o piso
  const r: RegraComissao = { tipo: 'piso_percentual', valorFixo: 1500, pct: 1 }
  assert.equal(calcularComissaoColaborador(r, 100_000).valorComissao, 1500)
})

test('piso+%: % vence quando supera o piso', () => {
  // 1% de 300k = 3.000 > piso 1.500 → ganha o %
  const r: RegraComissao = { tipo: 'piso_percentual', valorFixo: 1500, pct: 1 }
  assert.equal(calcularComissaoColaborador(r, 300_000).valorComissao, 3000)
})

// ── faixas progressivas ─────────────────────────────────────
const faixas = {
  tipo: 'faixas' as const,
  faixas: [
    { ate: 100_000, pct: 1 },
    { ate: 150_000, pct: 1.5 },
    { ate: 200_000, pct: 2 },
    { ate: null, pct: 2.5 }, // acima de 200k
  ],
}

test('faixas: vendido 80k cai na faixa até 100k (1%) = 800', () => {
  assert.equal(calcularComissaoColaborador(faixas, 80_000).valorComissao, 800)
})

test('faixas: vendido 140k cai na faixa até 150k (1,5%) = 2.100', () => {
  assert.equal(calcularComissaoColaborador(faixas, 140_000).valorComissao, 2100)
})

test('faixas: vendido 250k cai na faixa "acima" (2,5%) = 6.250', () => {
  assert.equal(calcularComissaoColaborador(faixas, 250_000).valorComissao, 6250)
})

test('faixas: faixa com valor fixo', () => {
  const r: RegraComissao = {
    tipo: 'faixas',
    faixas: [{ ate: 100_000, valor: 1000 }, { ate: null, valor: 5000 }],
  }
  assert.equal(calcularComissaoColaborador(r, 50_000).valorComissao, 1000)
  assert.equal(calcularComissaoColaborador(r, 500_000).valorComissao, 5000)
})

// ── auxiliares ──────────────────────────────────────────────
test('normalizarFaixas ordena por teto, null por último', () => {
  const out = normalizarFaixas([{ ate: null, pct: 3 }, { ate: 200_000, pct: 2 }, { ate: 100_000, pct: 1 }])
  assert.deepEqual(out.map((f) => f.ate), [100_000, 200_000, null])
})

test('regra inativa retorna 0', () => {
  const r: RegraComissao = { tipo: 'percentual', pct: 5, ativo: false }
  assert.equal(calcularComissaoColaborador(r, 100_000).valorComissao, 0)
})
