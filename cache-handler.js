/**
 * Custom Next.js cache handler — in-memory only.
 *
 * No Railway o filesystem do app é read-only fora dos Volumes montados, e
 * o cache padrão do Next tenta gravar em /app/.next/cache (EACCES).
 *
 * Esta implementação guarda tudo em Map() do processo. Cada réplica tem o
 * próprio cache (sem coerência entre instâncias), que é OK para nosso caso:
 * unstable_cache com TTL curto + revalidateTag.
 *
 * Limite: 1000 entradas por processo (LRU simples).
 */

const MAX_ENTRIES = 1000

class InMemoryCache {
  constructor() {
    this.cache = new Map()
    this.tagsByKey = new Map() // key -> Set<tag>
    this.keysByTag = new Map() // tag -> Set<key>
  }

  _touch(key) {
    // LRU: re-insere pra ir pro fim
    const v = this.cache.get(key)
    if (v) {
      this.cache.delete(key)
      this.cache.set(key, v)
    }
  }

  _evictIfNeeded() {
    while (this.cache.size > MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value
      this._removeKey(firstKey)
    }
  }

  _removeKey(key) {
    const tags = this.tagsByKey.get(key)
    if (tags) {
      for (const tag of tags) {
        const keys = this.keysByTag.get(tag)
        if (keys) {
          keys.delete(key)
          if (keys.size === 0) this.keysByTag.delete(tag)
        }
      }
      this.tagsByKey.delete(key)
    }
    this.cache.delete(key)
  }

  async get(key) {
    this._touch(key)
    const entry = this.cache.get(key)
    if (!entry) return null
    // Verifica TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._removeKey(key)
      return null
    }
    return entry
  }

  async set(key, data, ctx) {
    const tags = ctx?.tags ?? []
    const revalidate = ctx?.revalidate
    const expiresAt =
      typeof revalidate === 'number' && revalidate > 0
        ? Date.now() + revalidate * 1000
        : null

    this._removeKey(key) // limpa tags antigas

    this.cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags,
      expiresAt,
    })

    if (tags.length > 0) {
      this.tagsByKey.set(key, new Set(tags))
      for (const tag of tags) {
        if (!this.keysByTag.has(tag)) this.keysByTag.set(tag, new Set())
        this.keysByTag.get(tag).add(key)
      }
    }

    this._evictIfNeeded()
  }

  async revalidateTag(tagOrTags) {
    const tags = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags]
    for (const tag of tags) {
      const keys = this.keysByTag.get(tag)
      if (!keys) continue
      for (const key of [...keys]) {
        this._removeKey(key)
      }
    }
  }
}

module.exports = InMemoryCache
