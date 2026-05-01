/**
 * Price Sync Service
 * Synchronizes live prices from Investing.com to database
 * Can be called periodically via API endpoint or job scheduler
 */

import { db } from './db'
import { getGrainPrices } from './investing-client'
import { redis } from './redis'

export interface PriceSyncResult {
  success: boolean
  timestamp: Date
  graos: {
    soja?: { preco: number; armazenado: boolean }
    milho?: { preco: number; armazenado: boolean }
    trigo?: { preco: number; armazenado: boolean }
  }
  taxaCambio?: { taxa: number; armazenado: boolean }
  errors?: string[]
}

/**
 * Sync prices from Investing.com to database
 * Stores latest prices in Cotacao table
 */
export async function syncPrices(): Promise<PriceSyncResult> {
  const result: PriceSyncResult = {
    success: true,
    timestamp: new Date(),
    graos: {},
    errors: [],
  }

  try {
    console.log('[PriceSync] Iniciando sincronização de preços...')

    // Check if sync is already running (prevent duplicate syncs)
    const syncLock = await redis.get('price-sync-lock')
    if (syncLock) {
      console.log('[PriceSync] Sincronização já em progresso, pulando...')
      return {
        ...result,
        success: false,
        errors: ['Sincronização já em progresso'],
      }
    }

    // Set lock for 5 minutes
    await redis.setex('price-sync-lock', 300, '1')

    // Fetch prices from Investing.com
    const prices = await getGrainPrices()

    // Store soja
    if (prices.soja !== null) {
      try {
        await db.cotacao.create({
          data: {
            grao: 'soja',
            preco: prices.soja,
            simbolo: 'ZS',
            fonte: 'Investing.com',
            dolarReal: prices.taxaCambio ? prices.taxaCambio : undefined,
          },
        })
        result.graos.soja = { preco: prices.soja, armazenado: true }
        console.log(`[PriceSync] Soja armazenada: ${prices.soja}`)
      } catch (err) {
        const errorMsg = `Erro ao armazenar soja: ${err instanceof Error ? err.message : 'Unknown'}`
        result.errors?.push(errorMsg)
        console.error(`[PriceSync] ${errorMsg}`)
      }
    }

    // Store milho
    if (prices.milho !== null) {
      try {
        await db.cotacao.create({
          data: {
            grao: 'milho',
            preco: prices.milho,
            simbolo: 'ZC',
            fonte: 'Investing.com',
            dolarReal: prices.taxaCambio ? prices.taxaCambio : undefined,
          },
        })
        result.graos.milho = { preco: prices.milho, armazenado: true }
        console.log(`[PriceSync] Milho armazenado: ${prices.milho}`)
      } catch (err) {
        const errorMsg = `Erro ao armazenar milho: ${err instanceof Error ? err.message : 'Unknown'}`
        result.errors?.push(errorMsg)
        console.error(`[PriceSync] ${errorMsg}`)
      }
    }

    // Store trigo
    if (prices.trigo !== null) {
      try {
        await db.cotacao.create({
          data: {
            grao: 'trigo',
            preco: prices.trigo,
            simbolo: 'ZW',
            fonte: 'Investing.com',
            dolarReal: prices.taxaCambio ? prices.taxaCambio : undefined,
          },
        })
        result.graos.trigo = { preco: prices.trigo, armazenado: true }
        console.log(`[PriceSync] Trigo armazenado: ${prices.trigo}`)
      } catch (err) {
        const errorMsg = `Erro ao armazenar trigo: ${err instanceof Error ? err.message : 'Unknown'}`
        result.errors?.push(errorMsg)
        console.error(`[PriceSync] ${errorMsg}`)
      }
    }

    // Store exchange rate
    if (prices.taxaCambio !== null) {
      try {
        await db.taxaCambio.create({
          data: {
            origem: 'USD',
            destino: 'BRL',
            taxa: prices.taxaCambio,
            fonte: 'Investing.com',
          },
        })
        result.taxaCambio = { taxa: prices.taxaCambio, armazenado: true }
        console.log(`[PriceSync] Taxa cambio armazenada: ${prices.taxaCambio}`)
      } catch (err) {
        const errorMsg = `Erro ao armazenar taxa câmbio: ${err instanceof Error ? err.message : 'Unknown'}`
        result.errors?.push(errorMsg)
        console.error(`[PriceSync] ${errorMsg}`)
      }
    }

    result.success = (result.errors?.length ?? 0) === 0

    console.log('[PriceSync] Sincronização concluída:', result.success ? 'SUCESSO' : 'COM ERROS')

    return result
  } catch (error) {
    console.error('[PriceSync] Erro crítico na sincronização:', error)
    return {
      ...result,
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  } finally {
    // Remove lock
    await redis.del('price-sync-lock')
  }
}

/**
 * Get latest prices for all grains from database
 */
export async function getLatestPrices() {
  try {
    const latestSoja = await db.cotacao.findFirst({
      where: { grao: 'soja' },
      orderBy: { data: 'desc' },
    })

    const latestMilho = await db.cotacao.findFirst({
      where: { grao: 'milho' },
      orderBy: { data: 'desc' },
    })

    const latestTrigo = await db.cotacao.findFirst({
      where: { grao: 'trigo' },
      orderBy: { data: 'desc' },
    })

    const latestRate = await db.taxaCambio.findFirst({
      orderBy: { data: 'desc' },
    })

    return {
      soja: latestSoja,
      milho: latestMilho,
      trigo: latestTrigo,
      taxaCambio: latestRate,
    }
  } catch (error) {
    console.error('Error getting latest prices:', error)
    return null
  }
}
