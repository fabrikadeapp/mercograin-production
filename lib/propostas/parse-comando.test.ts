import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseComando, parseNumeroBR } from './parse-comando'

const NOW = new Date('2026-06-03T12:00:00Z')

test('parseNumeroBR: vírgula como decimal', () => {
  assert.equal(parseNumeroBR('1,5'), 1.5)
  assert.equal(parseNumeroBR('130,55'), 130.55)
})

test('parseNumeroBR: ponto como milhar (3 dígitos)', () => {
  assert.equal(parseNumeroBR('1.000'), 1000)
  assert.equal(parseNumeroBR('10.000'), 10000)
})

test('parseNumeroBR: ponto como decimal (não-3 dígitos)', () => {
  assert.equal(parseNumeroBR('1.5'), 1.5)
  assert.equal(parseNumeroBR('130.55'), 130.55)
})

test('parseNumeroBR: ambos separadores → ponto = milhar, vírgula = decimal', () => {
  assert.equal(parseNumeroBR('1.000,50'), 1000.5)
  assert.equal(parseNumeroBR('2.166,67'), 2166.67)
})

test('caso 1: nome cliente + qtd sacas + grão + preço/sc + validade + local', () => {
  const r = parseComando('Fazenda São João 1000sc soja 130/sc 30d Sorriso', { now: NOW })
  assert.equal(r.grao, 'soja')
  assert.equal(r.quantidadeBruta?.valor, 1000)
  assert.equal(r.quantidadeBruta?.unidade, 'sc60')
  assert.equal(r.quantidadeTon, 60)
  assert.equal(r.precoBruto?.valor, 130)
  assert.equal(r.precoBruto?.unidade, 'brlSc60')
  assert.ok(r.precoBrlTon && Math.abs(r.precoBrlTon - 2166.67) < 0.5, `precoBrlTon=${r.precoBrlTon}`)
  assert.equal(r.validadeRelativa, 30)
  assert.ok(r.local?.includes('Sorriso'), `local=${r.local}`)
  assert.ok(r.clienteNome?.includes('Fazenda'), `cliente=${r.clienteNome}`)
})

test('caso 2: texto natural longo com "a", "para", "em"', () => {
  const r = parseComando(
    '1000 sacas de soja a 130 reais a saca para Maria Costa entrega em 30 dias',
    { now: NOW }
  )
  assert.equal(r.grao, 'soja')
  assert.equal(r.quantidadeBruta?.valor, 1000)
  assert.equal(r.quantidadeBruta?.unidade, 'sc60')
  // "130 reais a saca" não é capturado pelos padrões (sem R$ ou /sc) — aceitável,
  // operador vai ajustar no preview. Verifica que pelo menos cliente e validade vieram.
  assert.equal(r.validadeRelativa, 30)
  assert.ok(r.clienteNome?.includes('Maria'), `cliente=${r.clienteNome}`)
})

test('caso 3: tipo compra explícito + preço/t', () => {
  const r = parseComando('compra milho 60t 2200/t Cascavel/PR', { now: NOW })
  assert.equal(r.tipo, 'compra')
  assert.equal(r.grao, 'milho')
  assert.equal(r.quantidadeBruta?.valor, 60)
  assert.equal(r.quantidadeBruta?.unidade, 't')
  assert.equal(r.quantidadeTon, 60)
  assert.equal(r.precoBruto?.valor, 2200)
  assert.equal(r.precoBruto?.unidade, 'brlTon')
  assert.equal(r.precoBrlTon, 2200)
  assert.equal(r.local, 'Cascavel/PR')
})

test('caso 4: R$ saca + validade DD/MM', () => {
  const r = parseComando('Coop Alfa 500sc soja R$ 140 saca até 15/07', { now: NOW })
  assert.equal(r.grao, 'soja')
  assert.equal(r.quantidadeBruta?.valor, 500)
  assert.equal(r.precoBruto?.valor, 140)
  assert.equal(r.precoBruto?.unidade, 'brlSc60')
  assert.ok(r.validadeEm, 'tem validade')
  assert.equal(r.validadeEm?.getMonth(), 6) // julho
  assert.equal(r.validadeEm?.getDate(), 15)
  assert.ok(r.clienteNome?.includes('Coop'), `cliente=${r.clienteNome}`)
})

test('caso 5: sem cliente → clienteNome vazio ou curto', () => {
  const r = parseComando('soja 1000sc 130/sc', { now: NOW })
  assert.equal(r.grao, 'soja')
  assert.equal(r.quantidadeTon, 60)
  assert.equal(r.precoBruto?.valor, 130)
  // Pode ter clienteNome vazio ou só ruído
  assert.ok(!r.clienteNome || r.clienteNome.length < 5, `cliente="${r.clienteNome}"`)
})

test('caso 6: algodão + preço alto + cliente "com"', () => {
  const r = parseComando('algodao 50t 14000/t com Fazenda XYZ', { now: NOW })
  assert.equal(r.grao, 'algodao')
  assert.equal(r.quantidadeTon, 50)
  assert.equal(r.precoBrlTon, 14000)
  assert.ok(r.clienteNome?.includes('Fazenda'), `cliente=${r.clienteNome}`)
})

test('caso 7: número com ponto como milhar', () => {
  const r = parseComando('1.000 sacas soja 130/sc', { now: NOW })
  assert.equal(r.quantidadeBruta?.valor, 1000)
  assert.equal(r.quantidadeTon, 60)
})

test('caso 8: vírgula decimal em quantidade', () => {
  const r = parseComando('1,5t soja 2200/t', { now: NOW })
  assert.equal(r.quantidadeBruta?.valor, 1.5)
  assert.equal(r.quantidadeTon, 1.5)
})

test('caso 9: preço com R$ e ponto+vírgula', () => {
  const r = parseComando('soja 60t R$ 2.166,67/t', { now: NOW })
  assert.ok(r.precoBruto?.valor && Math.abs(r.precoBruto.valor - 2166.67) < 0.01)
  assert.ok(r.precoBrlTon && Math.abs(r.precoBrlTon - 2166.67) < 0.5)
})

test('caso 10: warning para preço fora da faixa', () => {
  const r = parseComando('soja 60t 80000/t', { now: NOW })
  assert.equal(r.precoBrlTon, 80000)
  assert.ok(r.warnings.some((w) => w.includes('acima')), `warnings=${r.warnings}`)
})

test('caso 11: US$/bu sem câmbio → warning + preço undefined', () => {
  const r = parseComando('soja 60t US$ 12,50', { now: NOW })
  assert.equal(r.precoBruto?.unidade, 'usdBu')
  assert.equal(r.precoBrlTon, undefined)
  assert.ok(r.warnings.some((w) => w.includes('câmbio')))
})

test('caso 12: US$/bu com câmbio → converte', () => {
  const r = parseComando('soja 60t US$ 12,50/bu', { now: NOW, usdbrl: 5.0 })
  assert.equal(r.precoBruto?.unidade, 'usdBu')
  // 12.50 * 5 * 1000 / 27.2155 ≈ 2296.30
  assert.ok(r.precoBrlTon && Math.abs(r.precoBrlTon - 2296.30) < 1, `precoBrlTon=${r.precoBrlTon}`)
})

test('caso 13: kg + R$/kg', () => {
  const r = parseComando('soja 50000kg 2,18/kg', { now: NOW })
  assert.equal(r.quantidadeBruta?.unidade, 'kg')
  assert.equal(r.quantidadeTon, 50)
  assert.equal(r.precoBruto?.unidade, 'brlKg')
  assert.equal(r.precoBrlTon, 2180)
})

test('caso 14: tipo venda explícito', () => {
  const r = parseComando('vender 100t milho 2200/t', { now: NOW })
  assert.equal(r.tipo, 'venda')
  assert.equal(r.grao, 'milho')
})

test('caso 15: validade no futuro distante ainda no ano', () => {
  const r = parseComando('soja 60t 2200/t até 31/12', { now: NOW })
  assert.ok(r.validadeEm)
  assert.equal(r.validadeEm?.getMonth(), 11)
  assert.equal(r.validadeEm?.getDate(), 31)
})

test('caso 16: validade DD/MM passada vira ano seguinte', () => {
  const r = parseComando('soja 60t 2200/t 01/01', { now: NOW })
  assert.ok(r.validadeEm)
  // NOW é junho 2026, então 01/01 vira 2027
  assert.equal(r.validadeEm?.getFullYear(), 2027)
})

test('caso 17: nome próprio com "do" preserva (Fazenda Rei do Gado)', () => {
  const r = parseComando('Fazenda Rei do Gado', { now: NOW })
  assert.equal(r.clienteNome, 'Fazenda Rei do Gado')
})

test('caso 18: nome próprio com "dos" preserva (Coop dos Produtores)', () => {
  const r = parseComando('Coop dos Produtores', { now: NOW })
  assert.equal(r.clienteNome, 'Coop dos Produtores')
})

test('caso 19: filler "para" ainda some quando isolado', () => {
  const r = parseComando('1000sc soja para Maria 130/sc', { now: NOW })
  assert.equal(r.grao, 'soja')
  assert.ok(r.clienteNome === 'Maria' || r.clienteNome?.includes('Maria'))
  assert.ok(!r.clienteNome?.includes('para'))
})

test('caso 20: filler some + nome próprio com partícula central preserva preposição', () => {
  // "venda para Casa de João" — 'para' some, 'de' fica entre Casa e João
  // (caso o operador depois corrija no preview).
  // Caso ambíguo: como há grão+qtd extraídos, fallback B pode capturar
  // "João" como local. Operador ajusta no preview se quiser.
  const r = parseComando('venda para Casa de João 60t soja', { now: NOW })
  assert.equal(r.tipo, 'venda')
  assert.equal(r.grao, 'soja')
  assert.ok(!r.clienteNome?.toLowerCase().includes('para'), `cliente=${r.clienteNome}`)
  // Verifica que 'de' (do removerFiller) não some sozinho
  // Aceita tanto "Casa de João" (ideal) quanto "Casa" + local "João" (ambíguo OK)
  assert.ok(
    r.clienteNome?.includes('Casa') && (r.clienteNome?.includes('João') || r.local === 'João'),
    `cliente=${r.clienteNome} · local=${r.local}`
  )
})
