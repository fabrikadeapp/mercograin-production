/**
 * redis.ts
 * Cliente Redis para cache (opcional)
 * Se Redis não estiver disponível, cache é desabilitado gracefully
 */

import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL

let redis: Redis | null = null
let isConnected = false

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 5000
    })

    redis.on('error', (err) => {
      console.warn('[Redis] Erro (cache desabilitado):', err.message)
      isConnected = false
    })

    redis.on('connect', () => {
      console.log('[Redis] Conectado')
      isConnected = true
    })

    redis.on('close', () => {
      console.warn('[Redis] Desconectado')
      isConnected = false
    })
  } catch (err) {
    console.warn('[Redis] Não foi possível conectar. Cache será desabilitado.')
    redis = null
  }
}

// Wrapper para operações Redis seguras
const safeRedis = {
  async get(key: string): Promise<string | null> {
    if (!redis || !isConnected) return null
    try {
      return await redis.get(key)
    } catch (err) {
      console.warn('[Redis] Erro ao GET:', err)
      return null
    }
  },
  async setex(key: string, ttl: number, value: string): Promise<void> {
    if (!redis || !isConnected) return
    try {
      await redis.setex(key, ttl, value)
    } catch (err) {
      console.warn('[Redis] Erro ao SETEX:', err)
    }
  },
  async incr(key: string): Promise<number> {
    if (!redis || !isConnected) return 1
    try {
      return await redis.incr(key)
    } catch (err) {
      console.warn('[Redis] Erro ao INCR:', err)
      return 1
    }
  },
  async ttl(key: string): Promise<number> {
    if (!redis || !isConnected) return -1
    try {
      return await redis.ttl(key)
    } catch (err) {
      console.warn('[Redis] Erro ao TTL:', err)
      return -1
    }
  },
  async expire(key: string, seconds: number): Promise<void> {
    if (!redis || !isConnected) return
    try {
      await redis.expire(key, seconds)
    } catch (err) {
      console.warn('[Redis] Erro ao EXPIRE:', err)
    }
  },
  async del(key: string): Promise<void> {
    if (!redis || !isConnected) return
    try {
      await redis.del(key)
    } catch (err) {
      console.warn('[Redis] Erro ao DEL:', err)
    }
  },
  async ping(): Promise<string> {
    if (!redis || !isConnected) throw new Error('Redis not connected')
    try {
      return await redis.ping()
    } catch (err) {
      console.warn('[Redis] Erro ao PING:', err)
      throw err
    }
  }
}

export { safeRedis as redis }
