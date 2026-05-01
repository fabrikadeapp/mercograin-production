import { z } from 'zod'

// TradingView Webhook Schema
export const tradingViewWebhookSchema = z.object({
  ticker: z.string().min(1, 'ticker obrigatório').toUpperCase(),
  timestamp: z.number().int().positive('timestamp deve ser positivo'),
  price: z.number().positive('price deve ser positivo'),
  signal: z.enum(['buy', 'sell', 'hold'], {
    errorMap: () => ({ message: 'signal deve ser buy, sell ou hold' }),
  }),
  volume: z.number().nonnegative('volume não pode ser negativo').optional(),
  strength: z.number().min(0).max(100, 'strength deve estar entre 0 e 100').optional(),
  description: z.string().optional(),
})

export type TradingViewWebhook = z.infer<typeof tradingViewWebhookSchema>

// Braspag Webhook Schema (para futuro uso)
export const braspagWebhookSchema = z.object({
  Id: z.string(),
  MerchantOrderId: z.string(),
  Customer: z.object({
    Name: z.string().optional(),
    Email: z.string().optional(),
  }).optional(),
  Payment: z.object({
    ServiceTaxAmount: z.number().optional(),
    Installment: z.number().optional(),
    Interest: z.string().optional(),
    Status: z.number(),
    ReturnCode: z.string().optional(),
    ReturnMessage: z.string().optional(),
    AuthorizationCode: z.string().optional(),
    ProviderReturnCode: z.string().optional(),
    ProviderReturnMessage: z.string().optional(),
    Amount: z.number().optional(),
    ReceivedDate: z.string().optional(),
    CapturedAmount: z.number().optional(),
    CapturedDate: z.string().optional(),
  }).optional(),
})

export type BraspagWebhook = z.infer<typeof braspagWebhookSchema>

// Webhook Log Schema (para auditoria)
export const webhookLogSchema = z.object({
  tipo: z.enum(['tradingview', 'braspag', 'signaturely']),
  payload: z.record(z.unknown()),
  status: z.enum(['recebido', 'processado', 'erro']),
  mensagem: z.string().optional(),
  codigoErro: z.string().optional(),
  ipOrigem: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
})

export type WebhookLog = z.infer<typeof webhookLogSchema>
