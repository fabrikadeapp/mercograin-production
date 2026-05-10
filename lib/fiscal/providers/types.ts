/**
 * Abstração de provider fiscal — permite trocar NFE.io ↔ eNotas ↔ Webmania ↔ Tecnospeed
 * sem mudar código de negócio.
 */

export interface NFeItemPayload {
  descricao: string
  ncm: string
  cfop: string
  qtd: number
  unidade: string
  valorUnitario: number
  valorTotal: number
  // Tributos pré-calculados (provider pode recalcular)
  valorICMS?: number
  valorPIS?: number
  valorCOFINS?: number
  aliquotaICMS?: number
  diferimentoICMS?: boolean
}

export interface NFeEmissaoPayload {
  tipo: 'entrada' | 'saida' | 'devolucao' | 'complementar' | 'triangular'
  modelo: '55' | '65'
  serie: number
  numero: number
  naturezaOperacao: string
  finalidadeEmissao: '1' | '2' | '3' | '4'
  ambiente: 'homologacao' | 'producao'
  // Emitente
  emitente: {
    cnpj: string
    nome: string
    inscricaoEstadual?: string
    uf: string
    regimeTributario: string
  }
  // Destinatário
  destinatario: {
    doc: string // CPF ou CNPJ
    nome: string
    uf: string
    inscricaoEstadual?: string
    email?: string
  }
  itens: NFeItemPayload[]
  totais: {
    valorProdutos: number
    valorICMS: number
    valorPIS: number
    valorCOFINS: number
    valorFrete: number
    valorOutros: number
    valorTotal: number
  }
  observacoes?: string
}

export interface NFeEmissaoResponse {
  ok: boolean
  status: 'autorizada' | 'rejeitada' | 'processando' | 'denegada'
  chave?: string
  protocolo?: string
  numero?: number
  serie?: number
  xmlUrl?: string
  danfeUrl?: string
  providerNFeId?: string
  motivoRejeicao?: string
  raw?: any
}

export interface NFeStatus {
  status: string
  protocolo?: string
  chave?: string
}

export interface FiscalProvider {
  nome: string
  emitirNFe(payload: NFeEmissaoPayload): Promise<NFeEmissaoResponse>
  cancelarNFe(chave: string, motivo: string): Promise<{ ok: boolean; protocolo?: string; erro?: string }>
  consultarNFe(chave: string): Promise<NFeStatus>
  enviarCartaCorrecao(
    chave: string,
    texto: string,
    sequencia: number
  ): Promise<{ ok: boolean; protocolo?: string; erro?: string }>
  baixarDANFE(chave: string): Promise<Buffer | { url: string }>
  baixarXML(chave: string): Promise<Buffer | { url: string }>
  testarConexao(): Promise<{ ok: boolean; mensagem: string }>
}
