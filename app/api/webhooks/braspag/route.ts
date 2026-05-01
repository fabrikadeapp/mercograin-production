/**
 * app/api/webhooks/braspag/route.ts
 * Webhook para receber notificações de pagamento do Braspag
 * Atualiza status dos boletos quando há transações
 */

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const braspagPaymentSchema = z.object({
  Id: z.string(),
  MerchantOrderId: z.string().optional(),
  Customer: z.object({
    Name: z.string().optional(),
    Email: z.string().optional(),
  }).optional(),
  Payment: z.object({
    PaymentId: z.string(),
    Status: z.number(),
    Amount: z.number().optional(),
    PaidDate: z.string().optional(),
    BoletoNumber: z.string().optional(),
    BarCodeNumber: z.string().optional(),
  }).optional(),
})

/**
 * POST /api/webhooks/braspag
 * Recebe notificações de transações do Braspag
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validar webhook secret
    const secret = req.headers.get('x-braspag-secret')
    if (secret !== process.env.BRASPAG_WEBHOOK_SECRET) {
      console.warn('[Braspag Webhook] Secret inválido')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse JSON
    let payload: unknown
    try {
      payload = await req.json()
    } catch (e) {
      console.error('[Braspag Webhook] JSON inválido:', e)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // 3. Validar payload
    let validatedPayload: z.infer<typeof braspagPaymentSchema>
    try {
      validatedPayload = braspagPaymentSchema.parse(payload)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('[Braspag Webhook] Validação falhou:', error.errors)

        await db.webhookLog.create({
          data: {
            tipo: 'braspag',
            payload: payload as never,
            status: 'erro' as any,
            mensagem: 'Validação de payload falhou' as any,
            codigoErro: 'INVALID_PAYLOAD' as any,
            ipOrigem: (req.headers.get('x-forwarded-for') || 'unknown') as any,
          } as any,
        }).catch(console.error)

        return NextResponse.json(
          { error: 'Invalid payload' },
          { status: 400 }
        )
      }
      throw error
    }

    const { Id, Payment } = validatedPayload

    if (!Payment || !Payment.PaymentId) {
      console.warn('[Braspag Webhook] Payload incompleto')
      return NextResponse.json(
        { error: 'Incomplete payload' },
        { status: 400 }
      )
    }

    // 4. Mapear status Braspag → status local
    const statusMap: Record<number, string> = {
      0: 'aberto',
      1: 'pago',
      2: 'cancelado',
      3: 'rejeitado',
      10: 'aberto',
      12: 'vencido',
    }

    const novoStatus = statusMap[Payment.Status] || 'aberto'

    // 5. Buscar boleto por braspagId
    const boleto = await db.boleto.findFirst({
      where: { braspagId: Payment.PaymentId },
    })

    if (!boleto) {
      console.warn(`[Braspag Webhook] Boleto não encontrado: ${Payment.PaymentId}`)

      await db.webhookLog.create({
        data: {
          tipo: 'braspag',
          payload: validatedPayload as never,
          status: 'erro' as any,
          mensagem: 'Boleto não encontrado' as any,
          codigoErro: 'BOLETO_NOT_FOUND' as any,
        } as any,
      }).catch(console.error)

      return NextResponse.json(
        { ok: true, message: 'Boleto não encontrado (ignorado)' },
        { status: 200 }
      )
    }

    // 6. Atualizar status do boleto
    const boletoAtualizado = await db.boleto.update({
      where: { id: boleto.id },
      data: {
        status: novoStatus,
      },
    })

    console.log(
      `[Braspag Webhook] ✅ Boleto atualizado: ${boleto.numero} → ${novoStatus}`
    )

    // 7. Log bem-sucedido
    await db.webhookLog.create({
      data: {
        tipo: 'braspag',
        payload: validatedPayload as never,
        status: 'processado' as any,
        mensagem: `Boleto atualizado: ${boletoAtualizado.numero} → ${novoStatus}` as any,
      } as any,
    }).catch(console.error)

    return NextResponse.json(
      {
        ok: true,
        boleto: {
          id: boletoAtualizado.id,
          numero: boletoAtualizado.numero,
          status: boletoAtualizado.status,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Braspag Webhook] Erro:', error)

    try {
      await db.webhookLog.create({
        data: {
          tipo: 'braspag',
          payload: { error: 'Internal server error' },
          status: 'erro' as any,
          mensagem: (error instanceof Error ? error.message : 'Unknown error') as any,
          codigoErro: 'INTERNAL_ERROR' as any,
        } as any,
      })
    } catch (logError) {
      console.error('[Braspag Webhook] Erro ao fazer log:', logError)
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
