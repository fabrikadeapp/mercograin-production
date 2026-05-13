import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, findColumn } from '../../lib/bhgrain/csv-parser'
import { parseClientesCsv } from '../../lib/bhgrain/clientes-import'

test('parser detecta delimiter , ; e tab', () => {
  assert.equal(parseCsv('a,b,c\n1,2,3').delimiter, ',')
  assert.equal(parseCsv('a;b;c\n1;2;3').delimiter, ';')
  assert.equal(parseCsv('a\tb\tc\n1\t2\t3').delimiter, '\t')
})

test('parser respeita aspas com vírgulas internas', () => {
  const r = parseCsv('nome,endereco\n"Silva, João","Rua A, 100"')
  assert.equal(r.rows[0].nome, 'Silva, João')
  assert.equal(r.rows[0].endereco, 'Rua A, 100')
})

test('parser ignora linhas em branco', () => {
  const r = parseCsv('a,b\n1,2\n\n3,4\n')
  assert.equal(r.rows.length, 2)
})

test('findColumn é tolerante a case e acentos', () => {
  assert.equal(findColumn(['Nome', 'Razão Social', 'E-mail'], ['nome']), 'Nome')
  assert.equal(findColumn(['Nome', 'Razão Social'], ['razao social']), 'Razão Social')
  assert.equal(findColumn(['endereço'], ['endereco']), 'endereço')
})

test('parseClientesCsv exige coluna nome', () => {
  const r = parseClientesCsv('foo,bar\n1,2')
  assert.equal(r.validos.length, 0)
  assert.ok(r.erros.some((e) => /nome/.test(e.motivo)))
})

test('parseClientesCsv valida CNPJ por dígito', () => {
  // CNPJ válido conhecido: 11.222.333/0001-81 (DV calculado)
  const csv = 'nome,cnpj\nEmpresa A,11.222.333/0001-81\nEmpresa B,11.222.333/0001-00'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos.length, 1)
  assert.equal(r.validos[0].nome, 'Empresa A')
  assert.equal(r.erros.length, 1)
  assert.match(r.erros[0].motivo, /CNPJ inválido/)
})

test('parseClientesCsv detecta CNPJ duplicado no arquivo', () => {
  const csv = 'nome,cnpj\nA,11.222.333/0001-81\nB,11222333000181'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos.length, 1)
  assert.ok(r.erros.some((e) => /duplicado/i.test(e.motivo)))
})

test('parseClientesCsv valida email', () => {
  const csv = 'nome,email\nA,foo@bar.com\nB,nao-eh-email'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos.length, 1)
  assert.ok(r.erros.some((e) => e.campo === 'email'))
})

test('parseClientesCsv aceita CPF válido', () => {
  // 529.982.247-25 é CPF válido conhecido
  const csv = 'nome,cpf\nFulano,529.982.247-25'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos.length, 1)
  assert.equal(r.validos[0].cpf, '529.982.247-25')
})

test('parseClientesCsv default tipo=ambos', () => {
  const csv = 'nome\nCliente Teste'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos[0].tipo, 'ambos')
})

test('parseClientesCsv aceita delimiter ; brasileiro', () => {
  const csv = 'nome;email;tipo\nCliente A;a@b.com;comprador\nCliente B;c@d.com;vendedor'
  const r = parseClientesCsv(csv)
  assert.equal(r.validos.length, 2)
  assert.equal(r.validos[0].tipo, 'comprador')
})
