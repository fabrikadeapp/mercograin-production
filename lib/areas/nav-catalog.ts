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
}

/** Navegação completa por área. */
export const NAV: Record<Area, NavItem[]> = {
  mesa: [
    { href: '/dashboard', label: 'Visão geral', icon: 'LayoutDashboard' },
    { href: '/solicitacoes', label: 'Solicitações', icon: 'Inbox' },
    { href: '/propostas', label: 'Propostas', icon: 'ListChecks' },
    { href: '/contratos', label: 'Contratos', icon: 'FileText' },
    { href: '/clientes', label: 'Clientes & CRM', icon: 'Users' },
    { href: '/cotacoes', label: 'Cotações ao vivo', icon: 'TrendingUp' },
    { href: '/calculadora', label: 'Calculadora', icon: 'Calculator' },
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
    { href: '/fluxo-de-caixa', label: 'Fluxo de caixa', icon: 'Coins' },
    { href: '/boletos', label: 'Boletos', icon: 'Wallet' },
    { href: '/fornecedores', label: 'Fornecedores', icon: 'Package' },
    { href: '/relatorios', label: 'Relatórios', icon: 'BarChart3' },
  ],
  gestao: [
    { href: '/perfil', label: 'Meu perfil', icon: 'User' },
    { href: '/configuracoes/marca', label: 'Marca & Logo', icon: 'Image' },
    { href: '/configuracoes', label: 'Configurações', icon: 'Settings' },
    { href: '/assinatura', label: 'Plano & assinatura', icon: 'CreditCard' },
    { href: '/fiscal', label: 'Fiscal & SPED', icon: 'Receipt' },
    { href: '/auditoria', label: 'Auditoria', icon: 'ShieldAlert' },
    { href: '/webhooks', label: 'Webhooks', icon: 'Server' },
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
  return items.filter((it) => {
    if (it.hidden) return false
    if (!it.requires) return true
    return enabledFeatures[it.requires] === true
  })
}
