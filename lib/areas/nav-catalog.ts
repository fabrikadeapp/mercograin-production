/**
 * Catálogo de navegação por área.
 *
 * Estrutura: 4 áreas (Mesa, Operação, Financeiro, Gestão), cada uma com itens
 * categorizados. Itens podem exigir uma feature do catálogo FEATURES (lib/features).
 * Quando a feature está OFF (kill-switch global ou desligada no workspace),
 * o item NÃO aparece na sidebar.
 */
import type { Area } from './index'
import type { FeatureKey } from '@/lib/features'

export interface NavItem {
  /** Rota canônica para o link. */
  href: string
  /** Label do item. */
  label: string
  /** Nome do ícone do lucide-react (string para serialização). */
  icon: string
  /** Feature necessária. Se ausente, item é core (sempre visível). */
  requires?: FeatureKey
  /** Grupo dentro da sidebar (opcional). */
  group?: string
  /** True = não exibir na sidebar (acesso direto via URL). */
  hidden?: boolean
  /**
   * Sub-itens aninhados. Quando presente, o item vira um grupo no dropdown:
   * o `label` é o cabeçalho da seção e os `children` são os links indentados.
   * O `href` do pai continua válido (atalho para a tela principal do grupo).
   */
  children?: NavItem[]
  /** Marca item ainda não implementado (exibido como "em breve", não clicável). */
  soon?: boolean
}

/** Navegação completa por área. */
export const NAV: Record<Area, NavItem[]> = {
  mesa: [
    { href: '/dashboard', label: 'Visão geral', icon: 'LayoutDashboard' },
    { href: '/leads/novo', label: 'Novo Lead', icon: 'UserPlus' },
    { href: '/leads', label: 'Leads', icon: 'Sparkles' },
    { href: '/clientes', label: 'Clientes', icon: 'Users' },
    {
      href: '/propostas',
      label: 'Propostas e Contratos',
      icon: 'FileText',
      children: [
        { href: '/propostas', label: 'Todas as propostas', icon: 'ListChecks' },
        { href: '/contratos', label: 'Todos os contratos', icon: 'FileText' },
        { href: '/propostas/kanban', label: 'Kanban', icon: 'Kanban' },
        { href: '/calculadora', label: 'Calculadora', icon: 'Calculator' },
      ],
    },
    { href: '/inbox', label: 'Inbox unificado', icon: 'Inbox' },
    { href: '/solicitacoes', label: 'Solicitações', icon: 'MessageSquare' },
    { href: '/demandas', label: 'Demandas de compra', icon: 'ShoppingCart', requires: 'demandas' },
    { href: '/match', label: 'Match de ofertas', icon: 'GitMerge', requires: 'match' },
    { href: '/negocios', label: 'Negócios', icon: 'Handshake', requires: 'match' },
    { href: '/cotacoes', label: 'Cotações ao vivo', icon: 'TrendingUp' },
    { href: '/alertas', label: 'Alertas de preço', icon: 'BellRing' },
    { href: '/aprovacoes', label: 'Aprovações', icon: 'CheckSquare' },
    // Opcionais (feature-flagged)
    { href: '/originacao', label: 'Originação', icon: 'Sprout', requires: 'originacao' },
    { href: '/hedge', label: 'Hedge & Futuros', icon: 'Shield', requires: 'hedge' },
    { href: '/risco', label: 'Risco', icon: 'AlertTriangle', requires: 'hedge' },
    { href: '/futuros', label: 'Futuros (book)', icon: 'LineChart', requires: 'hedge' },
    { href: '/ofertas', label: 'Marketplace', icon: 'ShoppingCart', requires: 'marketplace' },
    { href: '/classificados', label: 'Classificados', icon: 'Store', requires: 'classificados' },
  ],
  operacao: [
    // A área "Operação" só aparece quando feature 'logistica' está ON globalmente
    // (veja AREA_REQUIRES em AreaShell.tsx).
    { href: '/operacao', label: 'Visão da operação', icon: 'Truck', requires: 'logistica' },
    { href: '/logistica', label: 'Logística', icon: 'Truck', requires: 'logistica' },
    { href: '/propriedades', label: 'Propriedades', icon: 'MapPin', requires: 'eudr' },
    { href: '/eudr', label: 'EUDR / Compliance ambiental', icon: 'Leaf', requires: 'eudr' },
  ],
  financeiro: [
    { href: '/financeiro', label: 'Visão financeira', icon: 'TrendingUp' },
    { href: '/financeiro/receber', label: 'Contas a Receber', icon: 'ArrowDownCircle' },
    { href: '/financeiro/pagar', label: 'Contas a Pagar', icon: 'ArrowUpCircle' },
    { href: '/fluxo-de-caixa', label: 'Fluxo de caixa', icon: 'Coins' },
    { href: '/financeiro/conciliacao', label: 'Conciliação bancária', icon: 'GitCompare' },
    { href: '/boletos', label: 'Boletos', icon: 'Wallet' },
    { href: '/financeiro/corretagem', label: 'Corretagem', icon: 'Receipt' },
    { href: '/fornecedores', label: 'Fornecedores', icon: 'Package' },
    { href: '/fiscal', label: 'Fiscal & SPED', icon: 'FileText' },
    { href: '/relatorios', label: 'Relatórios financeiros', icon: 'BarChart3' },
  ],
  gestao: [
    {
      href: '/configuracoes',
      label: 'Configurações da empresa',
      icon: 'Settings',
      children: [
        { href: '/configuracoes/empresa', label: 'Dados da empresa', icon: 'Building2' },
        { href: '/configuracoes/marca', label: 'Marca & Logo', icon: 'Image' },
        { href: '/configuracoes/tema', label: 'Aparência & Tema', icon: 'Palette' },
        { href: '/gestao/equipe', label: 'Funcionários & permissões', icon: 'Users' },
        { href: '/configuracoes/integracoes', label: 'Integrações', icon: 'Plug' },
        { href: '/propostas/modelos', label: 'Modelo de proposta', icon: 'FileText' },
        { href: '/contratos/templates?tipo=compra', label: 'Modelo de contrato (compra)', icon: 'FileSignature' },
        { href: '/contratos/templates?tipo=venda', label: 'Modelo de contrato (venda)', icon: 'FileSignature' },
      ],
    },
    { href: '/admin-empresa', label: 'Dashboard administrativo', icon: 'LayoutDashboard' },
    { href: '/gestao/comissionamento', label: 'Comissionamento', icon: 'Percent', requires: 'comissionamento' },
    { href: '/gestao/ranking', label: 'Ranking & Metas', icon: 'Trophy' },
    { href: '/gestao/alertas', label: 'Alertas comerciais', icon: 'Bell' },
    { href: '/auditoria', label: 'Auditoria', icon: 'ShieldAlert' },
    { href: '/assinatura', label: 'Plano & assinatura', icon: 'CreditCard' },
    { href: '/perfil', label: 'Meu perfil', icon: 'User' },
    { href: '/webhooks', label: 'Webhooks', icon: 'Server', hidden: true },
    // Opcionais
    { href: '/whatsapp', label: 'WhatsApp Bot', icon: 'MessageCircle' },
    { href: '/laura', label: 'Laura.IA', icon: 'Bot', requires: 'laura_ai' },
  ],
}

/**
 * Filtra itens visíveis para um workspace, respeitando feature flags
 * (kill-switch global + flag por workspace).
 *
 * Itens sem `requires` ou com feature core são sempre visíveis.
 */
export function visibleItems(
  items: NavItem[],
  enabledFeatures: Record<string, boolean>,
): NavItem[] {
  return items
    .filter((it) => {
      if (it.hidden) return false
      if (!it.requires) return true
      return enabledFeatures[it.requires] === true
    })
    .map((it) =>
      it.children
        ? { ...it, children: visibleItems(it.children, enabledFeatures) }
        : it,
    )
    // Remove grupos que ficaram sem filhos visíveis.
    .filter((it) => !it.children || it.children.length > 0)
}
