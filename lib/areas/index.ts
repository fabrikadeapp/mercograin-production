/**
 * Áreas do produto BH Grain.
 *
 * 4 áreas verticais reorganizadas em 2026-05:
 *   - mesa: operação comercial (vendas, propostas, clientes, cotações)
 *   - financeiro: tesouraria (movimentos, conciliação, DRE, royalties)
 *   - fiscal: tributário (NF, SPED, compliance fiscal)
 *   - gestao: visão executiva (metas, equipe, configurações, BI, assinatura)
 *
 * Cada WorkspaceMember tem `areasPermitidas: string[]`. owner/admin
 * têm acesso a TODAS as áreas independente desse array.
 */

export const AREAS = ['mesa', 'financeiro', 'fiscal', 'gestao'] as const
export type Area = (typeof AREAS)[number]

export const AREA_LABEL: Record<Area, string> = {
  mesa: 'Mesa',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  gestao: 'Gestão',
}

export const AREA_DESCRICAO: Record<Area, string> = {
  mesa: 'Vendas, propostas, clientes, cotações e contratos.',
  financeiro: 'Tesouraria, movimentos, conciliação bancária e DRE.',
  fiscal: 'Notas fiscais, livros, SPED e compliance tributário.',
  gestao: 'Metas, indicadores executivos, equipe e configurações.',
}

/**
 * Mapeamento prefix-rota → área. Verificado por prefixo (startsWith).
 * Rotas mais específicas vêm ANTES das genéricas para o match correto.
 *
 * Padrão: cada prefix DEVE começar com / e DEVE existir como dir em app/.
 */
const ROUTE_AREAS: Array<{ prefix: string; area: Area }> = [
  // Gestão (CEO / admin) — mais específicas primeiro
  { prefix: '/gestao', area: 'gestao' },
  { prefix: '/admin-empresa', area: 'gestao' },
  { prefix: '/configuracoes', area: 'gestao' },
  { prefix: '/assinatura', area: 'gestao' },
  { prefix: '/perfil', area: 'gestao' },
  { prefix: '/relatorios/clevel', area: 'gestao' },
  { prefix: '/relatorios/benchmark', area: 'gestao' },
  { prefix: '/auditoria', area: 'gestao' },
  { prefix: '/webhooks', area: 'gestao' },

  // Fiscal / tributário
  { prefix: '/fiscal', area: 'fiscal' },
  { prefix: '/eudr', area: 'fiscal' },

  // Financeiro / tesouraria
  { prefix: '/financeiro', area: 'financeiro' },
  { prefix: '/fluxo-de-caixa', area: 'financeiro' },
  { prefix: '/boletos', area: 'financeiro' },
  { prefix: '/fornecedores', area: 'financeiro' },
  { prefix: '/relatorios/dre', area: 'financeiro' },
  { prefix: '/relatorios/dre-mesa', area: 'financeiro' },
  { prefix: '/relatorios/aging', area: 'financeiro' },
  { prefix: '/relatorios/curva-abc', area: 'financeiro' },
  { prefix: '/relatorios/aging-pagamentos', area: 'financeiro' },

  // Mesa (operação comercial — padrão da maioria das rotas)
  { prefix: '/bhgrain', area: 'mesa' },
  { prefix: '/dashboard', area: 'mesa' },
  { prefix: '/clientes', area: 'mesa' },
  { prefix: '/propostas', area: 'mesa' },
  { prefix: '/contratos', area: 'mesa' },
  { prefix: '/cotacoes', area: 'mesa' },
  { prefix: '/precos', area: 'mesa' },
  { prefix: '/ofertas', area: 'mesa' },
  { prefix: '/calculadora', area: 'mesa' },
  { prefix: '/hedge', area: 'mesa' },
  { prefix: '/futuros', area: 'mesa' },
  { prefix: '/risco', area: 'mesa' },
  { prefix: '/originacao', area: 'mesa' },
  { prefix: '/operacao', area: 'mesa' },
  { prefix: '/logistica', area: 'mesa' },
  { prefix: '/propriedades', area: 'mesa' },
  { prefix: '/classificados', area: 'mesa' },
  { prefix: '/whatsapp', area: 'mesa' },
  { prefix: '/aprovacoes', area: 'mesa' },
  { prefix: '/relatorios/corretor', area: 'mesa' },
  { prefix: '/relatorios', area: 'mesa' }, // fallback dos relatórios
]

/**
 * Rotas que TODOS podem acessar sem checagem de área. Inclui auth,
 * onboarding, conteúdo público e a página de "sem acesso".
 */
const PUBLIC_OR_NEUTRAL = [
  '/auth',
  '/onboarding',
  '/sobre',
  '/contato',
  '/legal',
  '/aceite',
  '/portal',
  '/playground',
  '/docs',
  '/sem-acesso',
  '/',
]

/**
 * Resolve a área canônica de uma rota. Null = neutra/pública.
 */
export function routeToArea(pathname: string): Area | null {
  if (!pathname) return null
  // Neutras
  for (const p of PUBLIC_OR_NEUTRAL) {
    if (pathname === p || pathname.startsWith(p + '/')) return null
  }
  // Match por prefix mais específico primeiro
  for (const { prefix, area } of ROUTE_AREAS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return area
  }
  return null
}

export interface AreaAccessUser {
  /** Role global do User (Mercograin admin). */
  globalRole?: string | null
  /** Role dentro do workspace ('owner' | 'admin' | 'member' | 'viewer'). */
  workspaceRole?: string | null
  /** Lista de áreas marcadas pelo CEO. Vazio = só 'mesa'. */
  areasPermitidas?: string[] | null
}

/**
 * Retorna true se o usuário tem acesso à área.
 * Regras:
 *  - admin global (Mercograin) → tudo
 *  - owner / admin do workspace → tudo
 *  - resto → checa areasPermitidas (ou ['mesa'] como fallback)
 */
export function canAccessArea(user: AreaAccessUser, area: Area): boolean {
  if (user.globalRole === 'admin') return true
  if (user.workspaceRole === 'owner' || user.workspaceRole === 'admin') return true
  const allowed = user.areasPermitidas && user.areasPermitidas.length > 0
    ? user.areasPermitidas
    : ['mesa']
  return allowed.includes(area)
}

/** Lista as áreas que o usuário pode ver — ordenadas por AREAS. */
export function listAccessibleAreas(user: AreaAccessUser): Area[] {
  if (user.globalRole === 'admin') return [...AREAS]
  if (user.workspaceRole === 'owner' || user.workspaceRole === 'admin') return [...AREAS]
  const allowed = user.areasPermitidas && user.areasPermitidas.length > 0
    ? user.areasPermitidas
    : ['mesa']
  return AREAS.filter((a) => allowed.includes(a))
}

/**
 * Default redirect quando user cai numa área que não tem acesso.
 * Retorna a 1ª área permitida (ou /bhgrain se Mesa for permitida).
 */
export function getDefaultRouteFor(user: AreaAccessUser): string {
  const accessible = listAccessibleAreas(user)
  if (accessible.length === 0) return '/sem-acesso'
  if (accessible.includes('mesa')) return '/bhgrain'
  // 1ª área permitida → entry point
  const first = accessible[0]
  return AREA_ENTRY[first]
}

/**
 * Entry point (página inicial) de cada área.
 */
export const AREA_ENTRY: Record<Area, string> = {
  mesa: '/bhgrain',
  financeiro: '/financeiro',
  fiscal: '/fiscal',
  gestao: '/admin-empresa',
}

/**
 * Sub-menu de cada área — usado pelo top-nav e dropdown de overflow.
 * Mantém compatibilidade com rotas que já existem.
 */
export interface AreaSubItem {
  href: string
  label: string
  description?: string
}

export const AREA_SUBMENU: Record<Area, AreaSubItem[]> = {
  mesa: [
    { href: '/bhgrain', label: 'Dashboard' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/propostas', label: 'Propostas' },
    { href: '/aprovacoes/propostas', label: 'Autorizações pendentes' },
    { href: '/laura', label: 'Laura.IA' },
    { href: '/contratos', label: 'Contratos' },
    { href: '/cotacoes', label: 'Cotações' },
    { href: '/precos', label: 'Preços ao vivo' },
    { href: '/ofertas', label: 'Ofertas' },
    { href: '/calculadora', label: 'Calculadora' },
    { href: '/hedge', label: 'Hedge' },
    { href: '/whatsapp', label: 'Inbox' },
  ],
  financeiro: [
    { href: '/financeiro', label: 'Dashboard' },
    { href: '/financeiro/movimentos', label: 'Movimentos' },
    { href: '/financeiro/comissoes', label: 'Comissões' },
    { href: '/financeiro/centros-custo', label: 'Centros de custo' },
    { href: '/financeiro/conciliacao', label: 'Conciliação OFX' },
    { href: '/financeiro/royalties', label: 'Royalties' },
    { href: '/fornecedores', label: 'Fornecedores' },
    { href: '/boletos', label: 'Boletos' },
    { href: '/fluxo-de-caixa', label: 'Fluxo de caixa' },
    { href: '/relatorios/dre', label: 'DRE' },
    { href: '/relatorios/aging-pagamentos', label: 'Aging' },
  ],
  fiscal: [
    { href: '/fiscal', label: 'Dashboard' },
    { href: '/fiscal/notas', label: 'NF-e' },
    { href: '/fiscal/sped', label: 'SPED' },
    { href: '/fiscal/guias', label: 'Guias' },
    { href: '/fiscal/simulador-uf', label: 'Simulador UF' },
    { href: '/fiscal/configuracao', label: 'Configuração' },
    { href: '/eudr', label: 'EUDR' },
    { href: '/auditoria', label: 'Auditoria' },
  ],
  gestao: [
    { href: '/admin-empresa', label: 'Dashboard' },
    { href: '/gestao/equipe', label: 'Equipe' },
    { href: '/configuracoes/empresa', label: 'Empresa' },
    { href: '/configuracoes/integracoes', label: 'Integrações' },
    { href: '/configuracoes/ai', label: 'Agente IA' },
    { href: '/relatorios/clevel', label: 'C-Level BI' },
    { href: '/assinatura', label: 'Assinatura' },
    { href: '/configuracoes', label: 'Configurações' },
  ],
}
