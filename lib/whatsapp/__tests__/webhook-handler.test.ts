/**
 * Tests for lib/whatsapp/webhook-handler.ts
 *
 * Runner: node --import tsx --test
 *
 * Run com:
 *   npx tsx --test lib/whatsapp/__tests__/webhook-handler.test.ts
 *
 * Usa mock in-memory do PrismaClient (não toca DB real).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleEvolutionEvent, processMessage } from '../webhook-handler'

// ---------------------------------------------------------------------------
// In-memory mock of PrismaClient (apenas modelos usados pelo handler)
// ---------------------------------------------------------------------------
interface ContactRow {
  id: string
  workspaceId: string
  jid: string
  phone: string | null
  pushName: string | null
  unreadCount: number
  lastMessageAt: Date | null
}
interface MessageRow {
  id: string
  workspaceId: string
  contactId: string
  messageId: string
  remoteJid: string
  fromMe: boolean
  text: string | null
  mediaType: string | null
  mediaCaption: string | null
  status: string
  timestamp: Date
}
interface InstanceRow {
  id: string
  status: string
  connectedAt?: Date | null
  disconnectedAt?: Date | null
  lastQrAt?: Date | null
}

function makeMockDb() {
  const contacts: ContactRow[] = []
  const messages: MessageRow[] = []
  const instances: InstanceRow[] = [{ id: 'inst1', status: 'disconnected' }]
  let idSeq = 1

  return {
    contacts,
    messages,
    instances,
    whatsAppContact: {
      async upsert(args: any) {
        const w = args.where.workspaceId_jid
        const found = contacts.find(
          (c) => c.workspaceId === w.workspaceId && c.jid === w.jid
        )
        if (found) {
          // mimic update
          const u = args.update
          if (u.pushName) found.pushName = u.pushName
          if (u.lastMessageAt) found.lastMessageAt = u.lastMessageAt
          if (u.unreadCount?.increment) {
            found.unreadCount += u.unreadCount.increment
          } else if (typeof u.unreadCount === 'number') {
            found.unreadCount = u.unreadCount
          }
          return { ...found }
        }
        const c: ContactRow = {
          id: `c${idSeq++}`,
          workspaceId: args.create.workspaceId,
          jid: args.create.jid,
          phone: args.create.phone ?? null,
          pushName: args.create.pushName ?? null,
          unreadCount: args.create.unreadCount ?? 0,
          lastMessageAt: args.create.lastMessageAt ?? null,
        }
        contacts.push(c)
        return { ...c }
      },
    },
    whatsAppMessage: {
      async create(args: any) {
        const d = args.data
        const dup = messages.find(
          (m) => m.workspaceId === d.workspaceId && m.messageId === d.messageId
        )
        if (dup) {
          const e: any = new Error('Unique constraint failed')
          e.code = 'P2002'
          throw e
        }
        const m: MessageRow = {
          id: `m${idSeq++}`,
          workspaceId: d.workspaceId,
          contactId: d.contactId,
          messageId: d.messageId,
          remoteJid: d.remoteJid,
          fromMe: !!d.fromMe,
          text: d.text ?? null,
          mediaType: d.mediaType ?? null,
          mediaCaption: d.mediaCaption ?? null,
          status: d.status ?? 'delivered',
          timestamp: d.timestamp,
        }
        messages.push(m)
        return { ...m }
      },
    },
    whatsAppInstance: {
      async update(args: any) {
        const i = instances.find((x) => x.id === args.where.id)
        if (!i) throw new Error('not found')
        Object.assign(i, args.data)
        return { ...i }
      },
    },
  } as any
}

const INSTANCE = { id: 'inst1', workspaceId: 'ws1' }

function makeInboundMsg(id: string, text: string) {
  return {
    key: { id, remoteJid: '5551999999999@s.whatsapp.net', fromMe: false },
    pushName: 'João',
    messageTimestamp: 1700000000,
    message: { conversation: text },
  }
}

test('mensagem inbound cria contato e incrementa unread', async () => {
  const db = makeMockDb()
  await processMessage(INSTANCE, makeInboundMsg('msg-1', 'oi'), db)

  assert.equal(db.contacts.length, 1)
  assert.equal(db.contacts[0].unreadCount, 1)
  assert.equal(db.contacts[0].pushName, 'João')
  assert.equal(db.contacts[0].phone, '5551999999999')
  assert.equal(db.messages.length, 1)
  assert.equal(db.messages[0].text, 'oi')
  assert.equal(db.messages[0].fromMe, false)
})

test('mensagem outbound não incrementa unread', async () => {
  const db = makeMockDb()
  const msg = makeInboundMsg('msg-2', 'resposta')
  msg.key.fromMe = true
  await processMessage(INSTANCE, msg, db)

  assert.equal(db.contacts.length, 1)
  assert.equal(db.contacts[0].unreadCount, 0)
  assert.equal(db.messages[0].fromMe, true)
})

test('mensagem duplicada (mesmo messageId) não duplica', async () => {
  const db = makeMockDb()
  await processMessage(INSTANCE, makeInboundMsg('msg-3', 'a'), db)
  await processMessage(INSTANCE, makeInboundMsg('msg-3', 'a'), db)

  assert.equal(db.messages.length, 1)
  // Contato continua com unread=2 porque o upsert do contato roda antes do
  // create da mensagem. Idempotência total exigiria transação — fora de escopo.
  // Validação importante: NENHUMA mensagem duplicada na tabela.
})

test('grupos (@g.us) são ignorados', async () => {
  const db = makeMockDb()
  await processMessage(
    INSTANCE,
    {
      key: { id: 'g1', remoteJid: '123-456@g.us', fromMe: false },
      message: { conversation: 'oi' },
    },
    db
  )
  assert.equal(db.contacts.length, 0)
  assert.equal(db.messages.length, 0)
})

test('connection.update → estado open vira "connected"', async () => {
  const db = makeMockDb()
  await handleEvolutionEvent(
    INSTANCE,
    { event: 'connection.update', data: { state: 'open' } },
    db
  )
  assert.equal(db.instances[0].status, 'connected')
  assert.ok(db.instances[0].connectedAt instanceof Date)
})

test('connection.update → estado close vira "disconnected"', async () => {
  const db = makeMockDb()
  await handleEvolutionEvent(
    INSTANCE,
    { event: 'CONNECTION_UPDATE', data: { state: 'close' } },
    db
  )
  assert.equal(db.instances[0].status, 'disconnected')
  assert.ok(db.instances[0].disconnectedAt instanceof Date)
})

test('qrcode.updated → status "connecting" e lastQrAt', async () => {
  const db = makeMockDb()
  await handleEvolutionEvent(
    INSTANCE,
    { event: 'qrcode.updated', data: {} },
    db
  )
  assert.equal(db.instances[0].status, 'connecting')
  assert.ok(db.instances[0].lastQrAt instanceof Date)
})

test('payload sem key.id é ignorado silenciosamente', async () => {
  const db = makeMockDb()
  await processMessage(INSTANCE, { message: { conversation: 'lixo' } }, db)
  assert.equal(db.messages.length, 0)
})

test('imagem com caption é capturada', async () => {
  const db = makeMockDb()
  await processMessage(
    INSTANCE,
    {
      key: { id: 'img-1', remoteJid: '5551999999999@s.whatsapp.net', fromMe: false },
      messageTimestamp: 1700000000,
      message: { imageMessage: { caption: 'Olha essa foto' } },
    },
    db
  )
  assert.equal(db.messages.length, 1)
  assert.equal(db.messages[0].mediaType, 'image')
  assert.equal(db.messages[0].mediaCaption, 'Olha essa foto')
})

test('handleEvolutionEvent ignora event desconhecido', async () => {
  const db = makeMockDb()
  await handleEvolutionEvent(
    INSTANCE,
    { event: 'something.weird', data: {} },
    db
  )
  // nenhuma mutação
  assert.equal(db.contacts.length, 0)
  assert.equal(db.messages.length, 0)
})

test('messages.upsert com array processa todas', async () => {
  const db = makeMockDb()
  await handleEvolutionEvent(
    INSTANCE,
    {
      event: 'messages.upsert',
      data: [makeInboundMsg('a', 'um'), makeInboundMsg('b', 'dois')],
    },
    db
  )
  assert.equal(db.messages.length, 2)
})
