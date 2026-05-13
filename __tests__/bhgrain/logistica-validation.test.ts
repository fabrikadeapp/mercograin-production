import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarLogistica } from '../../lib/bhgrain/logistica-validation'

const base = {
  freteTipo: null,
  freteCustoTotal: null,
  freteCustoUnit: null,
  modalTransporte: null,
  origem: null,
  destino: null,
}

test('input vazio: OK (todos opcionais)', () => {
  const r = validarLogistica(base)
  assert.equal(r.ok, true)
  assert.equal(r.errors.length, 0)
})

test('frete incluso sem custo → erro', () => {
  const r = validarLogistica({ ...base, freteTipo: 'incluso' })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /custo total ou custo\/unidade/.test(e)))
})

test('frete incluso com custoTotal positivo → OK', () => {
  const r = validarLogistica({ ...base, freteTipo: 'incluso', freteCustoTotal: 100 })
  assert.equal(r.ok, true)
})

test('frete incluso com custoUnit positivo → OK', () => {
  const r = validarLogistica({ ...base, freteTipo: 'incluso', freteCustoUnit: 5 })
  assert.equal(r.ok, true)
})

test('frete incluso com custoTotal zero → erro', () => {
  const r = validarLogistica({ ...base, freteTipo: 'incluso', freteCustoTotal: 0 })
  assert.equal(r.ok, false)
})

test('frete por conta do comprador, sem custo → OK', () => {
  const r = validarLogistica({ ...base, freteTipo: 'comprador' })
  assert.equal(r.ok, true)
})

test('hidroviário com origem = destino → erro', () => {
  const r = validarLogistica({ ...base, modalTransporte: 'hidroviario', origem: 'Santos', destino: 'Santos' })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /origem ≠ destino/.test(e)))
})

test('hidroviário com origem ≠ destino → OK', () => {
  const r = validarLogistica({ ...base, modalTransporte: 'hidroviario', origem: 'Manaus', destino: 'Santarém' })
  assert.equal(r.ok, true)
})

test('hidroviário sem origem/destino preenchidos → OK (não força preenchimento)', () => {
  const r = validarLogistica({ ...base, modalTransporte: 'hidroviario' })
  assert.equal(r.ok, true)
})

test('rodoviário com origem = destino → OK (válido para transporte local)', () => {
  const r = validarLogistica({ ...base, modalTransporte: 'rodoviario', origem: 'X', destino: 'X' })
  assert.equal(r.ok, true)
})

test('custos negativos → erro', () => {
  const r1 = validarLogistica({ ...base, freteCustoTotal: -50 })
  assert.equal(r1.ok, false)
  assert.ok(r1.errors.some((e) => /total/.test(e) && /negativo/.test(e)))

  const r2 = validarLogistica({ ...base, freteCustoUnit: -1 })
  assert.equal(r2.ok, false)
  assert.ok(r2.errors.some((e) => /unidade/.test(e) && /negativo/.test(e)))
})

test('múltiplos erros acumulam', () => {
  const r = validarLogistica({
    freteTipo: 'incluso',
    freteCustoTotal: -10,
    freteCustoUnit: null,
    modalTransporte: 'hidroviario',
    origem: 'A',
    destino: 'A',
  })
  assert.equal(r.ok, false)
  assert.ok(r.errors.length >= 2)
})
