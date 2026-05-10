/**
 * Provider MOCK — simula emissão sem chamar nenhuma SEFAZ/provider real.
 * Default quando NFEIO_API_KEY não está setado.
 *
 * Gera chave de acesso 44 dígitos formato válido (cUF + AAMM + CNPJ + mod + serie + numero + tpEmis + cNF + cDV).
 */

import type {
  FiscalProvider,
  NFeEmissaoPayload,
  NFeEmissaoResponse,
  NFeStatus,
} from './types'

const UF_CODIGO: Record<string, string> = {
  RS: '43', SC: '42', PR: '41', SP: '35', RJ: '33', MG: '31', ES: '32',
  MT: '51', MS: '50', GO: '52', DF: '53', BA: '29', PE: '26',
  CE: '23', PA: '15', AM: '13', RO: '11', AC: '12', RR: '14', AP: '16',
  TO: '17', MA: '21', PI: '22', RN: '24', PB: '25', AL: '27', SE: '28',
}

function dvChaveAcesso(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  for (let i = 0; i < chave43.length; i++) {
    const d = parseInt(chave43[chave43.length - 1 - i], 10)
    soma += d * pesos[i % pesos.length]
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return String(dv)
}

export function gerarChaveAcesso(payload: NFeEmissaoPayload): string {
  const cUF = UF_CODIGO[payload.emitente.uf] ?? '43'
  const hoje = new Date()
  const aamm = `${String(hoje.getFullYear()).slice(2)}${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const cnpj = payload.emitente.cnpj.replace(/\D/g, '').padStart(14, '0').slice(0, 14)
  const modelo = payload.modelo.padStart(2, '0')
  const serie = String(payload.serie).padStart(3, '0')
  const numero = String(payload.numero).padStart(9, '0')
  const tpEmis = '1'
  const cNF = String(Math.floor(10000000 + Math.random() * 89999999))
  const chave43 = cUF + aamm + cnpj + modelo + serie + numero + tpEmis + cNF
  return chave43 + dvChaveAcesso(chave43)
}

export class MockProvider implements FiscalProvider {
  nome = 'mock'

  async emitirNFe(payload: NFeEmissaoPayload): Promise<NFeEmissaoResponse> {
    // Simula 95% autorização, 5% rejeição (CNPJ inválido proposital)
    const chave = gerarChaveAcesso(payload)
    const cnpjLimpo = payload.emitente.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      return {
        ok: false,
        status: 'rejeitada',
        motivoRejeicao: 'CNPJ emitente inválido (mock)',
      }
    }
    if (payload.destinatario.doc.replace(/\D/g, '').length < 11) {
      return {
        ok: false,
        status: 'rejeitada',
        motivoRejeicao: 'Documento destinatário inválido (mock)',
      }
    }

    return {
      ok: true,
      status: 'autorizada',
      chave,
      protocolo: `${Date.now()}`,
      numero: payload.numero,
      serie: payload.serie,
      providerNFeId: `mock_${chave.slice(-8)}`,
      xmlUrl: `mock://xml/${chave}.xml`,
      danfeUrl: `mock://danfe/${chave}.pdf`,
      raw: { mock: true, ambiente: payload.ambiente },
    }
  }

  async cancelarNFe(chave: string, motivo: string) {
    if (motivo.length < 15) {
      return { ok: false, erro: 'Motivo de cancelamento deve ter ao menos 15 caracteres' }
    }
    return { ok: true, protocolo: `cancel_${Date.now()}` }
  }

  async consultarNFe(chave: string): Promise<NFeStatus> {
    return { status: 'autorizada', chave, protocolo: `consulta_${Date.now()}` }
  }

  async enviarCartaCorrecao(chave: string, texto: string, sequencia: number) {
    if (texto.length < 15) {
      return { ok: false, erro: 'Texto da CC-e deve ter ao menos 15 caracteres' }
    }
    if (sequencia < 1 || sequencia > 20) {
      return { ok: false, erro: 'Sequência da CC-e deve estar entre 1 e 20' }
    }
    return { ok: true, protocolo: `cce_${Date.now()}` }
  }

  async baixarDANFE(chave: string) {
    return { url: `mock://danfe/${chave}.pdf` }
  }

  async baixarXML(chave: string) {
    return { url: `mock://xml/${chave}.xml` }
  }

  async testarConexao() {
    return { ok: true, mensagem: 'Mock provider sempre OK (sem rede)' }
  }
}
