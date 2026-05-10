export interface TemplateVariable {
  key: string
  label: string
  category: string
  example: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Empresa
  { key: 'empresa.razaoSocial', label: 'Razão social', category: 'Empresa', example: 'BH Grain LTDA' },
  { key: 'empresa.cnpj', label: 'CNPJ', category: 'Empresa', example: '12.345.678/0001-99' },
  { key: 'empresa.endereco', label: 'Endereço', category: 'Empresa', example: 'Av Paulista, 1000' },
  { key: 'empresa.cidade', label: 'Cidade', category: 'Empresa', example: 'São Paulo' },
  { key: 'empresa.uf', label: 'UF', category: 'Empresa', example: 'SP' },
  { key: 'empresa.telefone', label: 'Telefone', category: 'Empresa', example: '(11) 99999-9999' },
  { key: 'empresa.email', label: 'Email', category: 'Empresa', example: 'contato@phbgrain.com' },

  // Cliente
  { key: 'cliente.nome', label: 'Razão social', category: 'Cliente', example: 'Cooperativa Vale Verde' },
  { key: 'cliente.cnpj', label: 'CNPJ', category: 'Cliente', example: '12.345.678/0001-22' },
  { key: 'cliente.endereco', label: 'Endereço', category: 'Cliente', example: 'Av Brasil, 500' },
  { key: 'cliente.telefone', label: 'Telefone', category: 'Cliente', example: '(11) 88888-8888' },
  { key: 'cliente.email', label: 'Email', category: 'Cliente', example: 'comercial@cooperativa.com' },

  // Contrato
  { key: 'contrato.numero', label: 'Número', category: 'Contrato', example: 'CT-2841' },
  { key: 'contrato.dataAssinatura', label: 'Data assinatura', category: 'Contrato', example: '12 de outubro de 2026' },
  { key: 'contrato.dataInicio', label: 'Data início', category: 'Contrato', example: '15/10/2026' },
  { key: 'contrato.dataFim', label: 'Data fim', category: 'Contrato', example: '15/11/2026' },
  { key: 'contrato.tipo', label: 'Tipo (venda/compra)', category: 'Contrato', example: 'venda' },
  { key: 'contrato.valorTotal', label: 'Valor total (R$)', category: 'Contrato', example: '1.771.635,00' },
  { key: 'contrato.valorExtenso', label: 'Valor por extenso', category: 'Contrato', example: 'um milhão setecentos e setenta e um mil...' },

  // Produto
  { key: 'produto.grao', label: 'Grão', category: 'Produto', example: 'Soja' },
  { key: 'produto.quantidade', label: 'Quantidade', category: 'Produto', example: '12.450' },
  { key: 'produto.preco', label: 'Preço (R$)', category: 'Produto', example: '142,30' },
  { key: 'produto.subtotal', label: 'Subtotal (R$)', category: 'Produto', example: '1.771.635,00' },
  { key: 'produto.unidade', label: 'Unidade', category: 'Produto', example: 'sc 60kg' },

  // Datas
  { key: 'hoje.data', label: 'Data de hoje', category: 'Datas', example: '12/05/2026' },
  { key: 'hoje.dataLonga', label: 'Data por extenso', category: 'Datas', example: '12 de maio de 2026' },
  { key: 'hoje.cidade', label: 'Cidade (empresa)', category: 'Datas', example: 'São Paulo' },
]

/** Mock context for preview rendering */
export function buildMockContext() {
  const map: Record<string, string> = {}
  for (const v of TEMPLATE_VARIABLES) map[v.key] = v.example
  return map
}
