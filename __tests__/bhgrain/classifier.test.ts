import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classificarHeuristica, montarRascunho } from '../../lib/bhgrain/ai-classifier'

test('detecta pedido de cotação com commodity + quantidade', () => {
  const r = classificarHeuristica('Oi! Preciso de 1.000 sacas de soja para entrega em Passo Fundo.')
  assert.equal(r.intencao, 'pedido_cotacao')
  assert.equal(r.status, 'pronta_para_proposta')
  assert.equal(r.commodity, 'Soja')
  assert.equal(r.quantidade, 1000)
  assert.equal(r.unidade, 'sc')
  assert.equal(r.dadosFaltantes.length, 0)
})

test('detecta pedido com dados parciais → pendente_info', () => {
  const r = classificarHeuristica('Qual preço da soja hoje?')
  assert.equal(r.intencao, 'pedido_cotacao')
  assert.equal(r.status, 'pendente_info')
  assert.ok(r.dadosFaltantes.includes('quantidade'))
})

test('aceite detectado', () => {
  const r = classificarHeuristica('Fechado, pode preparar o contrato.')
  assert.equal(r.intencao, 'aceite')
})

test('recusa detectada', () => {
  const r = classificarHeuristica('Sem interesse no momento, obrigado.')
  assert.equal(r.intencao, 'recusa')
})

test('mensagem irrelevante', () => {
  const r = classificarHeuristica('Bom dia, tudo bem?')
  assert.equal(r.intencao, 'irrelevante')
  assert.equal(r.status, 'nao_comercial')
})

test('toneladas reconhecidas', () => {
  const r = classificarHeuristica('Quero comprar 50 toneladas de milho')
  assert.equal(r.commodity, 'Milho')
  assert.equal(r.quantidade, 50)
  assert.equal(r.unidade, 'ton')
})

test('número com milhar 2.000 sacas', () => {
  const r = classificarHeuristica('Preciso de 2.000 sacas de trigo')
  assert.equal(r.quantidade, 2000)
  assert.equal(r.commodity, 'Trigo')
})

test('montarRascunho retorna null quando status != pronta_para_proposta', () => {
  const r = classificarHeuristica('Qual o preço?')
  assert.equal(montarRascunho(r, null), null)
})

test('montarRascunho monta payload completo', () => {
  const c = classificarHeuristica('Preciso de 1000 sacas de soja')
  const r = montarRascunho(c, { valor: 119.8, fonte: 'CBOT', capturadaEm: new Date('2024-05-12T10:00:00Z') })
  assert.ok(r)
  assert.equal(r?.commodity, 'Soja')
  assert.equal(r?.quantidade, 1000)
  assert.equal(r?.precoSugerido, 119.8)
})
