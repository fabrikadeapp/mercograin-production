/**
 * Offline queue para POSTs/PUTs/PATCHs/DELETEs quando o navegador está offline.
 *
 * Usa IndexedDB nativo (sem dependências). Quando online volta, o app
 * deve chamar `flushQueue()` para reprocessar requisições pendentes.
 *
 * Padrão típico:
 *   if (!navigator.onLine) {
 *     await enqueue({ url, method, body, headers })
 *     return // optimistic UI
 *   }
 *   // fluxo normal
 *
 * E em algum hook global:
 *   window.addEventListener('online', () => flushQueue())
 */

import { useEffect, useState } from 'react'

const DB_NAME = 'bh-grain-offline'
const STORE = 'queue'
const DB_VERSION = 1

export interface QueuedRequest {
  id: string
  url: string
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body: any
  headers: Record<string, string>
  createdAt: number
}

// ============================================================
// IndexedDB abertura (idempotente)
// ============================================================
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB indisponível neste ambiente'))
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const result: any = fn(store)
        // Duck-type: trata como IDBRequest se tiver onsuccess/onerror;
        // senão assume thenable.
        if (result && 'onsuccess' in result) {
          result.onsuccess = () => resolve(result.result as T)
          result.onerror = () => reject(result.error)
        } else if (result && typeof result.then === 'function') {
          result.then(resolve, reject)
        } else {
          resolve(result as T)
        }
        tx.onerror = () => reject(tx.error)
      })
  )
}

// ============================================================
// API pública
// ============================================================

function uuid(): string {
  // crypto.randomUUID quando disponível, senão fallback
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function enqueue(
  req: Omit<QueuedRequest, 'id' | 'createdAt'>
): Promise<QueuedRequest> {
  const item: QueuedRequest = {
    ...req,
    id: uuid(),
    createdAt: Date.now(),
  }
  await withStore('readwrite', (s) => s.add(item))
  return item
}

export async function getAll(): Promise<QueuedRequest[]> {
  return withStore<QueuedRequest[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedRequest[]>)
}

export async function getQueueLength(): Promise<number> {
  return withStore<number>('readonly', (s) => s.count() as IDBRequest<number>)
}

export async function remove(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

export async function clearQueue(): Promise<void> {
  await withStore('readwrite', (s) => s.clear())
}

/**
 * Tenta reenviar todas as requisições da fila. Em caso de sucesso (status < 500),
 * remove da fila. 5xx ou erro de rede: mantém pra próxima tentativa.
 */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (typeof fetch === 'undefined') return { ok: 0, failed: 0 }
  const items = await getAll()
  let ok = 0
  let failed = 0
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...item.headers },
        body: item.body == null ? undefined : JSON.stringify(item.body),
      })
      if (res.status < 500) {
        // 2xx, 4xx — request foi entregue (4xx é erro de validação, não vale tentar de novo)
        await remove(item.id)
        ok++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }
  return { ok, failed }
}

// ============================================================
// Hook React
// ============================================================
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [queueLen, setQueueLen] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getQueueLength()
        .then((n) => !cancelled && setQueueLen(n))
        .catch(() => {})
    }
    const onOnline = async () => {
      setIsOnline(true)
      await flushQueue().catch(() => null)
      refresh()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(id)
    }
  }, [])

  return { isOnline, queueLen, flush: flushQueue, enqueue }
}
