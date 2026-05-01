/**
 * lib/braspag-client.ts
 * Cliente wrapper para Braspag API
 * Gerencia criação de boletos, consulta status, cancelamentos
 */

import axios, { AxiosInstance } from 'axios'

interface BraspagBoletoRequest {
  merchantOrderId: string
  numero: string
  valor: number
  vencimento: Date
  cliente: {
    nome: string
    email?: string
    telefone?: string
    cpf?: string
    cnpj?: string
  }
  beneficiario: {
    banco: string
    agencia: string
    conta: string
    dv?: string
    nome: string
  }
  instrucoes?: string
}

interface BraspagBoletoResponse {
  id: string
  status: number
  link: string
  numeroDocumento: string
  barCodeNumber?: string
  expirationDate: string
  createdAt: string
}

interface BraspagStatusResponse {
  id: string
  status: number
  statusDescription: string
  boletoStatus: string
  paidAmount?: number
  paidDate?: string
}

export class BraspagClient {
  private client: AxiosInstance
  private merchantId: string
  private merchantKey: string
  private maxRetries = 3
  private retryDelay = 1000 // ms

  constructor() {
    this.merchantId = process.env.BRASPAG_MERCHANT_ID || ''
    this.merchantKey = process.env.BRASPAG_MERCHANT_KEY || ''

    if (!this.merchantId || !this.merchantKey) {
      console.warn('[Braspag] Credenciais não configuradas')
    }

    const baseURL = process.env.BRASPAG_API_URL || 'https://api.braspag.com.br'

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.merchantKey}`,
      },
      timeout: 10000,
    })
  }

  /**
   * Criar boleto no Braspag
   */
  async createBoleto(data: BraspagBoletoRequest): Promise<BraspagBoletoResponse> {
    const payload = {
      MerchantOrderId: data.merchantOrderId,
      Customer: {
        Name: data.cliente.nome,
        Email: data.cliente.email,
        Mobile: data.cliente.telefone,
        IdentityType: data.cliente.cpf ? 'CPF' : 'CNPJ',
        Identity: data.cliente.cpf || data.cliente.cnpj,
      },
      Payment: {
        Provider: data.beneficiario.banco,
        Type: 'Boleto',
        Amount: Math.round(data.valor * 100),
        DueDate: this.formatDate(data.vencimento),
        Boleto: {
          CartorioCode: '0',
          Instructions: data.instrucoes || '',
          DaysToFine: 0,
          FineAmount: 0,
          DaysToInterest: 0,
          InterestAmount: 0,
          DocumentNumber: data.numero,
        },
        BoletoInfo: {
          Bank: this.getBankCode(data.beneficiario.banco),
          Agencia: data.beneficiario.agencia,
          Conta: data.beneficiario.conta,
          ContaBeneficiario: data.beneficiario.conta,
          NomeBeneficiario: data.beneficiario.nome,
        },
      },
    }

    return this.retryRequest(async () => {
      const response = await this.client.post('/v2/sales', payload)

      if (response.data?.Payment?.BoletoLink) {
        return {
          id: response.data.Payment.PaymentId,
          status: response.status,
          link: response.data.Payment.BoletoLink,
          numeroDocumento: response.data.Payment.Boleto?.DocumentNumber || '',
          barCodeNumber: response.data.Payment.Boleto?.BarCodeNumber,
          expirationDate: response.data.Payment.Boleto?.ExpirationDate || '',
          createdAt: new Date().toISOString(),
        }
      }

      throw new Error('Invalid Braspag response: missing BoletoLink')
    })
  }

  /**
   * Consultar status de boleto
   */
  async getBoletoStatus(paymentId: string): Promise<BraspagStatusResponse> {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/v2/sales/${paymentId}`)

      if (response.data?.Payment) {
        const payment = response.data.Payment

        return {
          id: payment.PaymentId,
          status: response.status,
          statusDescription: payment.Status,
          boletoStatus: this.mapBoletoStatus(payment.Status),
          paidAmount: payment.PaidAmount ? payment.PaidAmount / 100 : undefined,
          paidDate: payment.PaidDate,
        }
      }

      throw new Error('Invalid Braspag response: missing Payment')
    })
  }

  /**
   * Cancelar boleto
   */
  async cancelBoleto(paymentId: string): Promise<boolean> {
    try {
      await this.retryRequest(async () => {
        const response = await this.client.put(`/v2/sales/${paymentId}/void`, {})
        return response.status === 200 || response.status === 204
      })

      return true
    } catch (error) {
      console.error('[Braspag] Erro ao cancelar boleto:', error)
      return false
    }
  }

  /**
   * Retry automático com exponential backoff
   */
  private async retryRequest<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt)
          console.warn(`[Braspag] Retry ${attempt + 1}/${this.maxRetries} após ${delay}ms`, lastError.message)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`[Braspag] Falhou após ${this.maxRetries} tentativas: ${lastError?.message}`)
  }

  /**
   * Formatar data para YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  /**
   * Mapear código de banco para nome
   */
  private getBankCode(banco: string): string {
    const codes: Record<string, string> = {
      'caixa': '104',
      'itau': '341',
      'bradesco': '237',
      'santander': '033',
      'bb': '001',
      'default': '999',
    }

    return codes[banco.toLowerCase()] || codes.default
  }

  /**
   * Mapear status Braspag para status brasileiro
   */
  private mapBoletoStatus(status: number): string {
    const statusMap: Record<number, string> = {
      0: 'pendente',
      1: 'pago',
      2: 'cancelado',
      3: 'rejeitado',
      10: 'aberto',
      12: 'vencido',
    }

    return statusMap[status] || 'desconhecido'
  }

  /**
   * Health check da API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/v2/sales', {
        params: { pageSize: 0 },
        timeout: 5000,
      })

      return response.status === 200
    } catch (error) {
      console.error('[Braspag] Health check falhou:', error)
      return false
    }
  }
}

// Singleton
let braspagClient: BraspagClient | null = null

export function getBraspagClient(): BraspagClient {
  if (!braspagClient) {
    braspagClient = new BraspagClient()
  }
  return braspagClient
}
