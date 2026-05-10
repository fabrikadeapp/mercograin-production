/**
 * Provider NFE.io — adapter pronto pra ativação.
 *
 * Ativa quando:
 *   NFEIO_API_KEY=... (env var)
 *   ConfiguracaoFiscal.providerNome='nfeio'
 *   ConfiguracaoFiscal.providerCompanyId=<id da empresa cadastrada no painel NFE.io>
 *
 * Documentação: https://nfe.io/docs/desenvolvedores/rest-api/nfe-de-produto/
 *
 * STATUS: estrutura completa, mas chamadas reais HTTP são placeholders.
 * Antes de ir live: validar payload via sandbox NFE.io, ajustar campos.
 */

import type {
  FiscalProvider,
  NFeEmissaoPayload,
  NFeEmissaoResponse,
  NFeStatus,
} from './types'

const NFEIO_BASE_URL = 'https://api.nfe.io/v1'

export class NFEioProvider implements FiscalProvider {
  nome = 'nfeio'

  constructor(
    private readonly apiKey: string,
    private readonly companyId: string,
    private readonly ambiente: 'homologacao' | 'producao' = 'homologacao'
  ) {}

  private headers() {
    return {
      Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  async emitirNFe(payload: NFeEmissaoPayload): Promise<NFeEmissaoResponse> {
    // Mapear NFeEmissaoPayload → schema NFE.io
    const body = {
      operation: payload.tipo === 'entrada' ? 'BusinessToBusiness' : 'BusinessToConsumer',
      operationType: payload.tipo === 'devolucao' ? 'Return' : 'Sale',
      naturalOperation: payload.naturezaOperacao,
      environment: payload.ambiente === 'producao' ? 'Production' : 'Development',
      borrower: {
        federalTaxNumber: payload.destinatario.doc.replace(/\D/g, ''),
        name: payload.destinatario.nome,
        address: { state: payload.destinatario.uf },
        municipalTaxNumber: payload.destinatario.inscricaoEstadual ?? undefined,
        email: payload.destinatario.email,
      },
      items: payload.itens.map((it) => ({
        description: it.descricao,
        ncm: it.ncm,
        cfop: it.cfop,
        quantity: it.qtd,
        unitOfMeasurement: it.unidade,
        unitAmount: it.valorUnitario,
        amount: it.valorTotal,
      })),
      total: {
        services: payload.totais.valorTotal,
        deductions: 0,
        unconditionedDiscount: 0,
        conditionedDiscount: 0,
      },
    }

    try {
      const r = await fetch(`${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      })
      const json: any = await r.json().catch(() => ({}))

      if (!r.ok) {
        return {
          ok: false,
          status: 'rejeitada',
          motivoRejeicao: json?.message || `HTTP ${r.status}`,
          raw: json,
        }
      }

      // NFE.io retorna assíncrono: provider emite eventos webhook quando autoriza.
      // Aqui retornamos 'processando' e callers devem consultar/aguardar webhook.
      return {
        ok: true,
        status: json.flowStatus === 'Issued' ? 'autorizada' : 'processando',
        chave: json.accessKey,
        protocolo: json.checkCode,
        providerNFeId: json.id,
        numero: json.number,
        serie: json.series,
        xmlUrl: json.xmlDownloadUri,
        danfeUrl: json.pdfDownloadUri,
        raw: json,
      }
    } catch (err: any) {
      return {
        ok: false,
        status: 'rejeitada',
        motivoRejeicao: err?.message || 'Erro de rede ao chamar NFE.io',
      }
    }
  }

  async cancelarNFe(chave: string, motivo: string) {
    try {
      const r = await fetch(
        `${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices/${chave}`,
        { method: 'DELETE', headers: this.headers(), body: JSON.stringify({ reason: motivo }) }
      )
      if (!r.ok) {
        const json: any = await r.json().catch(() => ({}))
        return { ok: false, erro: json?.message || `HTTP ${r.status}` }
      }
      const json: any = await r.json().catch(() => ({}))
      return { ok: true, protocolo: json?.cancellationProtocol }
    } catch (err: any) {
      return { ok: false, erro: err?.message }
    }
  }

  async consultarNFe(chave: string): Promise<NFeStatus> {
    try {
      const r = await fetch(
        `${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices/${chave}`,
        { headers: this.headers() }
      )
      const json: any = await r.json().catch(() => ({}))
      return {
        status: json?.flowStatus ?? 'desconhecido',
        protocolo: json?.checkCode,
        chave,
      }
    } catch {
      return { status: 'erro', chave }
    }
  }

  async enviarCartaCorrecao(chave: string, texto: string, sequencia: number) {
    // NFE.io: endpoint /correctionletter
    try {
      const r = await fetch(
        `${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices/${chave}/correctionletter`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ correction: texto, sequence: sequencia }),
        }
      )
      if (!r.ok) {
        const json: any = await r.json().catch(() => ({}))
        return { ok: false, erro: json?.message || `HTTP ${r.status}` }
      }
      const json: any = await r.json().catch(() => ({}))
      return { ok: true, protocolo: json?.protocol }
    } catch (err: any) {
      return { ok: false, erro: err?.message }
    }
  }

  async baixarDANFE(chave: string) {
    return { url: `${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices/${chave}/pdf` }
  }

  async baixarXML(chave: string) {
    return { url: `${NFEIO_BASE_URL}/companies/${this.companyId}/productinvoices/${chave}/xml` }
  }

  async testarConexao() {
    try {
      const r = await fetch(`${NFEIO_BASE_URL}/companies/${this.companyId}`, {
        headers: this.headers(),
      })
      if (!r.ok) {
        return { ok: false, mensagem: `NFE.io: HTTP ${r.status}` }
      }
      return { ok: true, mensagem: 'Conectado ao NFE.io' }
    } catch (err: any) {
      return { ok: false, mensagem: err?.message || 'Falha de conexão' }
    }
  }
}
