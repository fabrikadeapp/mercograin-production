/**
 * Tests pra offline-queue. Roda em Node com um mock mínimo de IndexedDB.
 * Run: npx tsx lib/pwa/offline-queue.test.ts
 */
import assert from 'node:assert/strict'

// ============================================================
// Mock IndexedDB minimalista (suficiente pra esta lib)
// ============================================================
type Rec = Record<string, any>

class MockRequest {
  result: any = undefined
  error: any = null
  onsuccess: ((this: any) => any) | null = null
  onerror: ((this: any) => any) | null = null
  constructor(fn: () => any) {
    queueMicrotask(() => {
      try {
        this.result = fn()
        this.onsuccess?.call(this)
      } catch (e) {
        this.error = e
        this.onerror?.call(this)
      }
    })
  }
}

class MockStore {
  constructor(private data: Map<string, Rec>) {}
  add(item: Rec) {
    return new MockRequest(() => {
      if (this.data.has(item.id)) throw new Error('dup')
      this.data.set(item.id, item)
      return item.id
    })
  }
  delete(id: string) {
    return new MockRequest(() => {
      this.data.delete(id)
      return undefined
    })
  }
  clear() {
    return new MockRequest(() => {
      this.data.clear()
      return undefined
    })
  }
  count() {
    return new MockRequest(() => this.data.size)
  }
  getAll() {
    return new MockRequest(() => Array.from(this.data.values()))
  }
}

class MockTx {
  onerror: ((this: any) => any) | null = null
  constructor(private store: MockStore) {}
  objectStore() { return this.store }
}

class MockDB {
  data = new Map<string, Rec>()
  objectStoreNames = { contains: (_: string) => true }
  createObjectStore() { return new MockStore(this.data) }
  transaction(_n: string, _mode: string) {
    return new MockTx(new MockStore(this.data))
  }
}

const db = new MockDB()
;(globalThis as any).indexedDB = {
  open() {
    const req: any = { onupgradeneeded: null, onsuccess: null, onerror: null, result: db }
    queueMicrotask(() => {
      req.onsuccess?.()
    })
    return req
  },
}

// fetch mock controlável
let fetchPlan: Array<{ status: number; throw?: boolean }> = []
;(globalThis as any).fetch = async (_url: string, _opts: any) => {
  const next = fetchPlan.shift()
  if (!next) return { status: 200 }
  if (next.throw) throw new Error('network')
  return { status: next.status }
}

// ============================================================
// Tests
// ============================================================
import { enqueue, getQueueLength, flushQueue, clearQueue, getAll } from './offline-queue'

let n = 0
async function test(name: string, fn: () => Promise<void> | void) {
  await fn()
  n++
  console.log(`  ✓ ${name}`)
}

;(async () => {
  console.log('offline-queue.test.ts')

  await clearQueue()

  await test('1. enqueue adiciona item e count reflete', async () => {
    await enqueue({
      url: '/api/tickets-balanca',
      method: 'POST',
      body: { peso: 30000 },
      headers: {},
    })
    assert.equal(await getQueueLength(), 1)
  })

  await test('2. enqueue gera id único e createdAt', async () => {
    await enqueue({ url: '/x', method: 'POST', body: {}, headers: {} })
    const all = await getAll()
    assert.equal(all.length, 2)
    const ids = new Set(all.map((r) => r.id))
    assert.equal(ids.size, 2)
    assert.ok(all.every((r) => typeof r.createdAt === 'number'))
  })

  await test('3. flushQueue remove itens 2xx e mantém 5xx', async () => {
    fetchPlan = [{ status: 200 }, { status: 500 }]
    const r = await flushQueue()
    assert.equal(r.ok, 1)
    assert.equal(r.failed, 1)
    assert.equal(await getQueueLength(), 1) // o 500 ficou
  })

  await test('4. flushQueue trata erro de rede como falha (mantém)', async () => {
    fetchPlan = [{ status: 0, throw: true }]
    const r = await flushQueue()
    assert.equal(r.ok, 0)
    assert.equal(r.failed, 1)
    assert.equal(await getQueueLength(), 1)
  })

  await test('5. clearQueue zera tudo', async () => {
    await clearQueue()
    assert.equal(await getQueueLength(), 0)
  })

  console.log(`  ${n} tests passed`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
