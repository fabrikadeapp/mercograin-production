/**
 * POST /api/cotacoes/sync
 * Manually sync prices from Investing.com to database
 * Can include optional bearer token for security
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncPrices } from '@/lib/price-sync-service'

export async function POST(request: NextRequest) {
  try {
    // Optional: Check for authorization token
    const authHeader = request.headers.get('Authorization')
    const expectedToken = process.env.PRICE_SYNC_TOKEN

    if (expectedToken && expectedToken.length > 0) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Token de autenticação ausente' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7)
      if (token !== expectedToken) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 403 }
        )
      }
    }

    console.log('[API] Sincronizando preços...')

    const result = await syncPrices()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing prices:', error)
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar cotações',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cotacoes/sync
 * Get sync status and instructions
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Endpoint de sincronização de cotações',
    method: 'POST',
    description: 'Sincroniza preços do Investing.com para o banco de dados',
    usage: 'POST /api/cotacoes/sync',
    headers: {
      'Authorization': 'Bearer PRICE_SYNC_TOKEN (opcional)',
      'Content-Type': 'application/json',
    },
    example: {
      curl: 'curl -X POST http://localhost:3000/api/cotacoes/sync -H "Authorization: Bearer seu-token"',
      result: {
        success: true,
        timestamp: new Date().toISOString(),
        graos: {
          soja: { preco: 620.5, armazenado: true },
          milho: { preco: 450.25, armazenado: true },
          trigo: { preco: 580.75, armazenado: true },
        },
        taxaCambio: { taxa: 4.95, armazenado: true },
      },
    },
  })
}
