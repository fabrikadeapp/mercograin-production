/**
 * Tests for lib/whatsapp/bot-commands.ts
 *
 * Runner: npx tsx --test lib/whatsapp/__tests__/bot-commands.test.ts
 *
 * Mocks db (cotacao, proposta, contrato) e sendText.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processCommand } from '../bot-commands'

interface SendCall {
  instanceName: string
  remoteJid: string
  text: string
}

function makeDeps(opts: {
  cotacoes?: Array<{ grao: string; preco: number; dolarReal?: number | null; data: Date }>
  propostas?: Array<{
    numero: string
    valorTotal: number
    status: string
    graos: any
    cliente: { nome: string } | null
  }>
  contratos?: Array<{
    numero: string
    statusAssinatura: string
    cliente: { nome: string } | null
    proposta: { graos: any; valorTotal: number } | null
  }>
} = {}) {
  const sent: SendCall[] = []
  const cotacoes = opts.cotacoes ?? []
  const propostas = opts.propostas ?? []
  const contratos = opts.contratos ?? []

  const db: any = {
    cotacao: {
      async findFirst(args: any) {
        const grao = args?.where?.grao
        const matched = cotacoes.filter((c) => c.grao === grao)
        if (matched.length === 0) return null
        // orderBy data desc
        matched.sort((a, b) => b.data.getTime() - a.data.getTime())
        return matched[0]
      },
      async findMany(args: any) {
        const grao = args?.where?.grao
        const since: Date | undefined = args?.where?.data?.gte
        let rows = cotacoes.filter((c) => c.grao === grao)
        if (since) rows = rows.filter((r) => r.data >= since)
        rows.sort((a, b) => a.data.getTime() - b.data.getTime())
        return rows
      },
    },
    proposta: {
      async findMany(_args: any) {
        return propostas.slice(0, 3).map((p) => ({
          numero: p.numero,
          valorTotal: p.valorTotal,
          status: p.status,
          graos: p.graos,
          cliente: p.cliente,
        }))
      },
    },
    contrato: {
      async findMany(_args: any) {
        return contratos.slice(0, 3).map((c) => ({
          numero: c.numero,
          statusAssinatura: c.statusAssinatura,
          cliente: c.cliente,
          proposta: c.proposta,
        }))
      },
    },
  }

  const sendText = async (
    instanceName: string,
    remoteJid: string,
    text: string
  ) => {
    sent.push({ instanceName, remoteJid, text })
    return { messageId: 'mock' }
  }

  return { db, sendText, sent }
}

const CTX = { workspaceId: 'ws1', instanceName: 'inst-x', remoteJid: '5551@s.whatsapp.net' }

test('mensagem sem barra não é comando', async () => {
  const deps = makeDeps()
  const result = await processCommand('Olá tudo bem', CTX, deps)
  assert.equal(result, false)
  assert.equal(deps.sent.length, 0)
})

test('comando inválido /foo não é reconhecido', async () => {
  const deps = makeDeps()
  const result = await processCommand('/foo', CTX, deps)
  assert.equal(result, false)
  assert.equal(deps.sent.length, 0)
})

test('/cotacao retorna 3 grãos + USD', async () => {
  const now = new Date()
  const deps = makeDeps({
    cotacoes: [
      { grao: 'soja', preco: 145.8, dolarReal: 5.05, data: now },
      { grao: 'milho', preco: 67.4, dolarReal: 5.05, data: now },
      { grao: 'trigo', preco: 1450, dolarReal: 5.05, data: now },
    ],
  })
  const result = await processCommand('/cotacao', CTX, deps)
  assert.equal(result, true)
  assert.equal(deps.sent.length, 1)
  const text = deps.sent[0].text
  assert.match(text, /Soja/)
  assert.match(text, /Milho/)
  assert.match(text, /Trigo/)
  assert.match(text, /USD\/BRL/)
  assert.match(text, /145,80/)
})

test('/cotacao soja retorna detalhado', async () => {
  const now = new Date()
  const ago8d = new Date(Date.now() - 8 * 86400_000)
  const ago3d = new Date(Date.now() - 3 * 86400_000)
  const deps = makeDeps({
    cotacoes: [
      { grao: 'soja', preco: 140, dolarReal: 5, data: ago8d },
      { grao: 'soja', preco: 142, dolarReal: 5, data: ago3d },
      { grao: 'soja', preco: 145.8, dolarReal: 5.05, data: now },
    ],
  })
  const result = await processCommand('/cotacao soja', CTX, deps)
  assert.equal(result, true)
  const text = deps.sent[0].text
  assert.match(text, /Soja — detalhe/)
  assert.match(text, /Atual: R\$ 145,80/)
  assert.match(text, /Variação 7d/)
  assert.match(text, /Mín 30d/)
  assert.match(text, /Máx 30d/)
})

test('/propostas com 0 propostas envia mensagem de vazio', async () => {
  const deps = makeDeps({ propostas: [] })
  const result = await processCommand('/propostas', CTX, deps)
  assert.equal(result, true)
  assert.match(deps.sent[0].text, /Nenhuma proposta/)
})

test('/propostas com 1 proposta lista corretamente', async () => {
  const deps = makeDeps({
    propostas: [
      {
        numero: '1234',
        valorTotal: 145000,
        status: 'enviada',
        graos: [{ grao: 'soja', quantidade: 1000, unidade: 'sc' }],
        cliente: { nome: 'Cooperativa Vale Verde' },
      },
    ],
  })
  const result = await processCommand('/propostas', CTX, deps)
  assert.equal(result, true)
  const text = deps.sent[0].text
  assert.match(text, /#1234/)
  assert.match(text, /Cooperativa Vale Verde/)
  assert.match(text, /ENVIADA/)
  assert.match(text, /Soja/)
})

test('/propostas com 3 propostas mostra todas', async () => {
  const deps = makeDeps({
    propostas: [
      { numero: 'A', valorTotal: 100, status: 'rascunho', graos: null, cliente: { nome: 'C1' } },
      { numero: 'B', valorTotal: 200, status: 'enviada', graos: null, cliente: { nome: 'C2' } },
      { numero: 'C', valorTotal: 300, status: 'assinada', graos: null, cliente: { nome: 'C3' } },
    ],
  })
  await processCommand('/propostas', CTX, deps)
  const text = deps.sent[0].text
  assert.match(text, /#A/)
  assert.match(text, /#B/)
  assert.match(text, /#C/)
})

test('/contratos com 0 contratos envia mensagem de vazio', async () => {
  const deps = makeDeps({ contratos: [] })
  const result = await processCommand('/contratos', CTX, deps)
  assert.equal(result, true)
  assert.match(deps.sent[0].text, /Nenhum contrato/)
})

test('/contratos lista contratos com cliente e valor', async () => {
  const deps = makeDeps({
    contratos: [
      {
        numero: 'A-2024-099',
        statusAssinatura: 'assinado',
        cliente: { nome: 'Cooperativa Vale Verde' },
        proposta: { graos: [{ grao: 'soja', quantidade: 1000, unidade: 'sc' }], valorTotal: 145000 },
      },
    ],
  })
  await processCommand('/contratos', CTX, deps)
  const text = deps.sent[0].text
  assert.match(text, /#A-2024-099/)
  assert.match(text, /Cooperativa Vale Verde/)
  assert.match(text, /ASSINADO/)
  assert.match(text, /145.000,00/)
})

test('/ajuda lista todos os comandos', async () => {
  const deps = makeDeps()
  const result = await processCommand('/ajuda', CTX, deps)
  assert.equal(result, true)
  const text = deps.sent[0].text
  assert.match(text, /\/cotacao/)
  assert.match(text, /\/propostas/)
  assert.match(text, /\/contratos/)
  assert.match(text, /\/ajuda/)
})

test('/help é alias de /ajuda', async () => {
  const deps = makeDeps()
  const result = await processCommand('/help', CTX, deps)
  assert.equal(result, true)
  assert.match(deps.sent[0].text, /Comandos disponíveis/)
})

test('/cotação (com acento) também funciona', async () => {
  const deps = makeDeps({
    cotacoes: [{ grao: 'soja', preco: 145, dolarReal: 5, data: new Date() }],
  })
  const result = await processCommand('/cotação', CTX, deps)
  assert.equal(result, true)
  assert.equal(deps.sent.length, 1)
})

test('texto vazio retorna false', async () => {
  const deps = makeDeps()
  assert.equal(await processCommand('', CTX, deps), false)
  assert.equal(await processCommand('   ', CTX, deps), false)
})
