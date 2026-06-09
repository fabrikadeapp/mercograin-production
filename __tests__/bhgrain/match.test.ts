import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreMatch, sugerirMatches, type OfertaLike } from '../../lib/match'

const venda = (o: Partial<OfertaLike> = {}): OfertaLike => ({
  id: 'v1', tipo: 'venda', cultura: 'soja', qtdSc: 1000, precoSc: 130, ...o,
})
const compra = (o: Partial<OfertaLike> = {}): OfertaLike => ({
  id: 'c1', tipo: 'compra', cultura: 'soja', qtdSc: 1000, precoSc: 130, ...o,
})

test('cultura diferente não casa', () => {
  assert.equal(scoreMatch(venda({ cultura: 'soja' }), compra({ cultura: 'milho' })), null)
})

test('match perfeito → score alto', () => {
  const m = scoreMatch(venda({ destino: 'PR' }), compra({ destino: 'PR' }))!
  assert.ok(m.score >= 85, `esperado ≥85, veio ${m.score}`)
  assert.ok(m.razoes.includes('preço fecha (compra ≥ venda)'))
})

test('preço da compra abaixo da venda reduz score', () => {
  const alto = scoreMatch(venda({ precoSc: 130 }), compra({ precoSc: 130 }))!
  const baixo = scoreMatch(venda({ precoSc: 130 }), compra({ precoSc: 100 }))!
  assert.ok(baixo.score < alto.score)
})

test('volume muito diferente reduz score', () => {
  const igual = scoreMatch(venda({ qtdSc: 1000 }), compra({ qtdSc: 1000 }))!
  const dispar = scoreMatch(venda({ qtdSc: 1000 }), compra({ qtdSc: 200 }))!
  assert.ok(dispar.score < igual.score)
})

test('qualidade: umidade dentro do limite ok', () => {
  const m = scoreMatch(
    venda({ qualidadeSpec: { umidade: 13, proteina: 38 } }),
    compra({ qualidadeSpec: { umidade: 14, proteina: 36 } }),
  )!
  assert.ok(m.razoes.includes('qualidade atende'))
})

test('qualidade: umidade acima do exigido penaliza', () => {
  const ok = scoreMatch(venda({ qualidadeSpec: { umidade: 13 } }), compra({ qualidadeSpec: { umidade: 14 } }))!
  const ruim = scoreMatch(venda({ qualidadeSpec: { umidade: 20 } }), compra({ qualidadeSpec: { umidade: 14 } }))!
  assert.ok(ruim.score < ok.score)
})

test('sugerirMatches ordena por score e respeita limiar', () => {
  const ofertas: OfertaLike[] = [
    venda({ id: 'v1', precoSc: 130, destino: 'PR' }),
    compra({ id: 'c1', precoSc: 130, destino: 'PR' }),  // bom
    compra({ id: 'c2', precoSc: 80, qtdSc: 100 }),       // ruim
  ]
  const res = sugerirMatches(ofertas, 40)
  assert.ok(res.length >= 1)
  assert.equal(res[0].demandaId, 'c1')
  assert.ok(res.every((m) => m.score >= 40))
})
