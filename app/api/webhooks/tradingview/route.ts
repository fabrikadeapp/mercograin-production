/**
 * app/api/webhooks/tradingview/route.ts
 * Webhook para receber cotações do TradingView com:
 * - Validação Zod de payload
 * - Idempotência com Redis (5min cache)
 * - Rate limiting (100 req/min por símbolo)
 * - Auditoria em banco de dados
 */

import { db } from '@/lib/db'
import { getExchangeRate } from '@/lib/investing-client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { tradingViewWebhookSchema } from '@/lib/schemas/webhook-schemas'
import { checkRateLimit, getIdempotencyKey, markIdempotencyComplete } from '@/lib/utils/rate-limiter'

// Mapeamento de símbolo TradingView para grão
const SYMBOL_TO_GRAO: Record<string, string> = {
  'ZS': 'soja',
  'ZC': 'milho',
  'ZW': 'trigo',
  'CBOT:ZS': 'soja',
  'CBOT:ZC': 'milho',
  'CBOT:ZW': 'trigo'
}

/**
 * POST /api/webhooks/tradingview
 * Recebe webhooks do TradingView com preços CBOT
 *
 * Body esperado:
 * {
 *   "ticker": "ZS",
 *   "price": 565.50,
 *   "timestamp": 1704067200,
 *   "signal": "buy",
 *   "volume": 150000,
 *   "strength": 75,
 *   "description": "Sinal de compra detectado"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validar webhook secret
    const secret = req.headers.get('x-tradingview-secret')
    if (secret !== process.env.TRADINGVIEW_WEBHOOK_SECRET) {
      console.warn('[TradingView] Webhook secret inválido')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse JSON com tratamento de erro
    let payload: unknown
    try {
      payload = await req.json()
    } catch (e) {
      console.error('[TradingView] JSON inválido:', e)
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // 3. Validar com Zod schema
    let validatedPayload: z.infer<typeof tradingViewWebhookSchema>
    try {
      validatedPayload = tradingViewWebhookSchema.parse(payload)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('[TradingView] Validação falhou:', error.errors)

        // Log do erro de validação
        await db.webhookLog.create({
          data: {
            tipo: 'tradingview',
            payload: payload as never,
            status: 'erro' as any,
            mensagem: 'Validação de payload falhou' as any,
            codigoErro: 'INVALID_PAYLOAD' as any,
            ipOrigem: (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown') as any,
          } as any,
        }).catch(console.error)

        return NextResponse.json(
          { error: 'Invalid payload', details: error.errors },
          { status: 400 }
        )
      }
      throw error
    }

    const { ticker, timestamp, price, signal } = validatedPayload

    // 4. Normalizar símbolo
    let symbol = ticker.toUpperCase()
    if (symbol.includes(':')) {
      symbol = symbol.split(':')[1]
    }

    if (!SYMBOL_TO_GRAO[symbol]) {
      console.warn(`[TradingView] Símbolo desconhecido: ${symbol}`)

      await db.webhookLog.create({
        data: {
          tipo: 'tradingview',
          payload: validatedPayload as never,
          status: 'erro' as any,
          mensagem: 'Símbolo desconhecido' as any,
          codigoErro: 'UNKNOWN_SYMBOL' as any,
          ipOrigem: (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown') as any,
        } as any,
      }).catch(console.error)

      return NextResponse.json(
        { error: `Unknown symbol: ${symbol}` },
        { status: 400 }
      )
    }

    const grao = SYMBOL_TO_GRAO[symbol]

    // 5. Verificar rate limiting (100 req/min por símbolo)
    const rateLimitKey = `webhook:tradingview:${symbol}:rate`
    const rateLimitResult = await checkRateLimit({
      key: rateLimitKey,
      limit: 100,
      windowMs: 60 * 1000, // 1 minuto
    })

    if (!rateLimitResult.success) {
      console.warn(`[TradingView] Rate limit excedido para ${symbol}`)

      await db.webhookLog.create({
        data: {
          tipo: 'tradingview',
          payload: validatedPayload as never,
          status: 'erro' as any,
          mensagem: 'Rate limit excedido' as any,
          codigoErro: 'RATE_LIMIT_EXCEEDED' as any,
          ipOrigem: (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown') as any,
        } as any,
      }).catch(console.error)

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
        },
        { status: 429 }
      )
    }

    // 6. Verificar idempotência (5 minutos)
    const idempotencyKey = `webhook:tradingview:${symbol}:${timestamp}`
    const idempotencyResult = await getIdempotencyKey(idempotencyKey, 300)

    if (!idempotencyResult.isNew) {
      console.log(`[TradingView] Webhook duplicado detectado para ${symbol} em ${timestamp}`)

      return NextResponse.json(
        {
          ok: true,
          message: 'Webhook duplicado (já processado)',
          timestamp,
        },
        { status: 409 }
      )
    }

    // 7. Processar webhook
    let dolarReal: number | null = null
    try {
      dolarReal = await getExchangeRate()
    } catch (error) {
      console.warn('[TradingView] Erro ao buscar taxa USD/BRL:', error)
    }

    // 8. Salvar cotação no banco
    const cotacao = await db.cotacao.create({
      data: {
        grao,
        preco: String(price),
        simbolo: symbol,
        fonte: 'TradingView',
        dolarReal: dolarReal ? String(dolarReal) : null,
        volume: validatedPayload.volume || null,
        data: new Date(timestamp * 1000),
      },
    })

    console.log(`[TradingView] ✅ Cotação salva: ${grao} - ${price} (USD/BRL: ${dolarReal})`)

    // 9. Log bem-sucedido
    await db.webhookLog.create({
      data: {
        tipo: 'tradingview',
        payload: validatedPayload as never,
        status: 'processado' as any,
        mensagem: `Cotação salva: ${grao} - ${price}` as any,
        ipOrigem: (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown') as any,
      } as any,
    }).catch(console.error)

    // 10. Marcar como processado (idempotência)
    await markIdempotencyComplete(
      idempotencyKey,
      JSON.stringify({ cotacaoId: cotacao.id }),
      300
    ).catch(console.error)

    return NextResponse.json(
      {
        ok: true,
        cotacao: {
          id: cotacao.id,
          grao: cotacao.grao,
          preco: cotacao.preco,
          dolarReal: cotacao.dolarReal,
          timestamp: cotacao.data,
        },
        metadata: {
          signal,
          rateLimitRemaining: rateLimitResult.remaining,
          rateLimitReset: rateLimitResult.resetTime,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[TradingView] ❌ Erro ao processar webhook:', error)

    // Tentar fazer log do erro
    try {
      await db.webhookLog.create({
        data: {
          tipo: 'tradingview',
          payload: { error: 'Failed to parse payload' },
          status: 'erro' as any,
          mensagem: (error instanceof Error ? error.message : 'Unknown error') as any,
          codigoErro: 'INTERNAL_SERVER_ERROR' as any,
          ipOrigem: (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown') as any,
        } as any,
      })
    } catch (logError) {
      console.error('[TradingView] Erro ao fazer log:', logError)
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
