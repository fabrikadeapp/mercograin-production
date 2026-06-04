/**
 * Testes de integração — exercitam o vertical proposta como ele é usado em produção.
 *
 * Foco: garantir que os módulos pure que construímos cooperam corretamente.
 * Testes que exigem db real (proposta-approval, contrato-auto-create) ficam
 * fora porque dependem de mocks complexos.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseComando } from './parse-comando'
import { calcularSugestaoPreco } from './sugestao-preco'
import { normalizarGraos, somaValorTotal, primeiroGrao } from './grao-item'
import {
  PROPOSTA_STATUS,
  isAberta,
  isFechadaSucesso,
  podeEditar,
  podeMarcarPerdida,
  podeDecidirPortal,
} from './status'
import { calcularAging } from './aging'

const NOW = new Date('2026-06-03T12:00:00')

test('integração: command-bar gera proposta válida', () => {
  // Operador digita
  const r = parseComando('Fazenda São João 1000sc soja 130/sc 30d Sorriso', { now: NOW })
  assert.ok(r.grao, 'parser detectou grão')
  assert.ok(r.quantidadeTon && r.quantidadeTon > 0)
  assert.ok(r.precoBrlTon && r.precoBrlTon > 0)
  assert.ok(r.validadeEm)

  // Sistema monta o array de grãos como vai pro banco
  const graos = [
    {
      grao: r.grao!,
      quantidade: r.quantidadeTon!,
      preco: r.precoBrlTon!,
      subtotal: Math.round(r.quantidadeTon! * r.precoBrlTon! * 100) / 100,
    },
  ]

  // Normaliza (passa pela lib que vai usar quando ler de volta)
  const normalizados = normalizarGraos(graos)
  assert.equal(normalizados.length, 1)
  assert.equal(normalizados[0].grao, 'soja')
  assert.ok(Math.abs(normalizados[0].quantidade - 60) < 0.001) // 1000sc = 60t

  const valorTotal = somaValorTotal(graos)
  assert.ok(valorTotal > 100000) // sanity: ~R$130k
})

test('integração: parse-comando + sugestão acima/abaixo da banda', () => {
  // Operador digita preço explicitamente
  const r = parseComando('soja 60t 2200/t', { now: NOW })
  assert.equal(r.precoBrlTon, 2200)

  // Sugestão calcula banda do cliente com histórico
  const sugestao = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: 0.05, // 5%
    historicoCliente: [
      { precoBrlTon: 2050, marketBrlTon: 2000, data: new Date('2026-04-01') },
      { precoBrlTon: 2080, marketBrlTon: 2020, data: new Date('2026-05-01') },
    ],
  })

  // 2200 está acima da banda (max ~2080)
  assert.ok(sugestao.bandaCliente)
  assert.ok(r.precoBrlTon! > sugestao.bandaCliente!.maxBrlTon)
})

test('integração: variant legada na soma de valor total', () => {
  const graosMisturados = [
    { grao: 'soja', quantidade: 50, preco: 2000, subtotal: 100000 },
    { commodity: 'milho', quantidadeSc: 1000 }, // legado, preco=0
    { grao: 'trigo', quantidade: 30, preco: 1800, subtotal: 54000 },
  ]
  const total = somaValorTotal(graosMisturados)
  assert.equal(total, 154000) // milho ignorado por preco=0

  const primeiro = primeiroGrao(graosMisturados)
  assert.equal(primeiro?.grao, 'soja')
})

test('integração: status canônico + aging', () => {
  // Proposta enviada hoje
  const p1Status = PROPOSTA_STATUS.ENVIADA
  assert.ok(isAberta(p1Status))
  assert.ok(!isFechadaSucesso(p1Status))
  assert.ok(!podeEditar(p1Status))
  assert.ok(podeDecidirPortal(p1Status))
  assert.ok(podeMarcarPerdida(p1Status))

  // Aging — vencida ontem
  const aging = calcularAging(new Date(NOW.getTime() - 86_400_000), NOW)
  assert.equal(aging.nivel, 'vencida')

  // Proposta fechada
  const p2Status = PROPOSTA_STATUS.ACEITA
  assert.ok(isFechadaSucesso(p2Status))
  assert.ok(!isAberta(p2Status))
  assert.ok(!podeMarcarPerdida(p2Status))
})

test('integração: contra-oferta gera diff válido', () => {
  // Proposta original
  const graosOriginal = [
    { grao: 'soja', quantidade: 60, preco: 2200, subtotal: 132000 },
  ]
  // Cliente propõe nova quantidade + preço
  const graosNovos = [
    { grao: 'soja', quantidade: 60, preco: 2050, subtotal: 123000 },
  ]

  const original = normalizarGraos(graosOriginal)
  const novos = normalizarGraos(graosNovos)

  assert.equal(original[0].preco, 2200)
  assert.equal(novos[0].preco, 2050)

  // O diff que vai pra contraOfertaMudancas
  const diff = {
    graos: { de: original, para: novos },
    valor: { de: somaValorTotal(graosOriginal), para: somaValorTotal(graosNovos) },
  }
  assert.equal(diff.valor.de, 132000)
  assert.equal(diff.valor.para, 123000)
})

test('integração: parser com USDBRL + sugestão US$', () => {
  // Operador digita preço em US$/bu
  const r = parseComando('soja 60t US$ 12,50/bu', { now: NOW, usdbrl: 5.0 })
  assert.equal(r.precoBruto?.unidade, 'usdBu')
  assert.ok(r.precoBrlTon)
  // 12.50 × 5 × 1000 / 27.2155 ≈ 2296
  assert.ok(Math.abs(r.precoBrlTon! - 2296) < 5)
})
