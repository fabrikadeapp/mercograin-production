/**
 * DisabledFiscalProvider — emissão fiscal desligada para o workspace.
 *
 * Substitui o antigo MockProvider em produção. Todas as operações
 * retornam erro explícito com mensagem orientando a configurar provider real.
 *
 * Nunca persiste URLs fake (mock://) no banco.
 */
import type {
  FiscalProvider,
  NFeEmissaoPayload,
  NFeEmissaoResponse,
  NFeStatus,
} from './types'

const MSG =
  'Emissão fiscal não está habilitada para este workspace. ' +
  'Configure ConfiguracaoFiscal.providerNome (ex.: nfeio) e a credencial correspondente.'

export class DisabledFiscalProvider implements FiscalProvider {
  nome = 'disabled'

  async emitirNFe(_p: NFeEmissaoPayload): Promise<NFeEmissaoResponse> {
    return {
      ok: false,
      status: 'rejeitada',
      motivoRejeicao: MSG,
    }
  }

  async cancelarNFe(_chave: string, _motivo: string) {
    return { ok: false, erro: MSG }
  }

  async consultarNFe(_chave: string): Promise<NFeStatus> {
    return { status: 'desconhecido' }
  }

  async enviarCartaCorrecao(_chave: string, _texto: string, _seq: number) {
    return { ok: false, erro: MSG }
  }

  async baixarDANFE(_chave: string): Promise<Buffer | { url: string }> {
    throw new Error(MSG)
  }

  async baixarXML(_chave: string): Promise<Buffer | { url: string }> {
    throw new Error(MSG)
  }

  async testarConexao() {
    return { ok: false, mensagem: MSG }
  }
}
