import {
  TrendingUp,
  FileText,
  Wallet,
  MessageCircle,
  BarChart3,
  Building2,
  type LucideIcon,
} from 'lucide-react'

export interface NavLink {
  label: string
  href: string
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Preços', href: '#precos' },
  { label: 'FAQ', href: '#faq' },
]

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export const FEATURES: Feature[] = [
  {
    icon: TrendingUp,
    title: 'Cotações ao vivo CEPEA/ESALQ',
    description:
      'Soja Paranaguá, milho, trigo em R$/sc 60kg + dólar comercial atualizando em tempo real. Sem dependência de planilhas.',
  },
  {
    icon: FileText,
    title: 'Pipeline de contratos',
    description:
      'Da prospecção ao fechamento. Status visual, alertas de vencimento, exportação CSV/PDF.',
  },
  {
    icon: Wallet,
    title: 'Fluxo de caixa preditivo',
    description:
      'Saldo projetado para 90 dias, a receber/pagar, composição por grão. Dashboard de tesouraria.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Bot integrado',
    description:
      'Notificações automáticas de boleto vencendo, contrato assinado, alertas de cotação. Sem spam, na mesa do cliente.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios de safra',
    description:
      'Margem média, tonelagem, top clientes, eficiência logística. Análise por canal e UF de origem.',
  },
  {
    icon: Building2,
    title: 'Multi-empresa & API',
    description:
      'Gerencie várias tradings em workspaces isolados. API REST para integrar com seu ERP.',
  },
]

export interface PricingPlan {
  id: 'starter' | 'pro' | 'enterprise'
  name: string
  price: string
  priceSuffix: string
  tagline: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  ctaVariant: 'primary' | 'ghost' | 'secondary'
  highlighted?: boolean
}

export const PRICING: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'R$ 197',
    priceSuffix: '/mês',
    tagline: 'Para trading individual',
    features: [
      '1 usuário',
      'Até 50 contratos/mês',
      'Cotações CEPEA ao vivo',
      'Relatórios básicos',
      'Suporte por email',
    ],
    ctaLabel: 'Iniciar trial · Starter',
    ctaHref: '/auth/signup?plan=starter',
    ctaVariant: 'secondary',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 497',
    priceSuffix: '/mês',
    tagline: 'Para mesas com até 5 traders',
    features: [
      '5 usuários',
      'Contratos ilimitados',
      'WhatsApp Bot',
      'Alertas customizados',
      'Relatórios avançados',
      'Multi-empresa',
      'Suporte prioritário',
    ],
    ctaLabel: 'Iniciar trial · Pro',
    ctaHref: '/auth/signup?plan=pro',
    ctaVariant: 'primary',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'R$ 1.497',
    priceSuffix: '/mês',
    tagline: 'Para grupos com múltiplas tradings',
    features: [
      'Usuários ilimitados',
      'API REST',
      'White-label',
      'Onboarding dedicado',
      'SLA 99.9%',
      'Suporte 24/7',
    ],
    ctaLabel: 'Falar com vendas',
    ctaHref: '/contato',
    ctaVariant: 'ghost',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    question: 'Como funciona o trial de 10 dias?',
    answer:
      'Você cadastra cartão, tem 10 dias completos com todos os recursos do plano. Não cobramos no trial. No 11º dia, cobramos automaticamente o primeiro mês. Cancele a qualquer momento e nada é cobrado.',
  },
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim, troque a qualquer momento. Diferenças são prorrateadas.',
  },
  {
    question: 'Como vocês recebem as cotações CEPEA?',
    answer:
      'Integramos diretamente com o widget oficial CEPEA/ESALQ. Atualização diária após o fechamento da bolsa.',
  },
  {
    question: 'Posso integrar com meu ERP?',
    answer:
      'Plano Enterprise inclui API REST. Pro tem exportação CSV/Excel completa.',
  },
  {
    question: 'Os dados são seguros?',
    answer:
      'Banco PostgreSQL criptografado em repouso, SSL/TLS em trânsito, isolamento por workspace, backups diários.',
  },
  {
    question: 'Onde os servidores ficam?',
    answer:
      'Hospedamos no Railway (US East), banco com backups automáticos.',
  },
  {
    question: 'Cancelo como?',
    answer:
      'Pelo painel ou contato@phbgrain.com. Cancela na hora, sem fidelidade.',
  },
]

export const FOOTER_LINKS = {
  produto: [
    { label: 'Recursos', href: '#recursos' },
    { label: 'Preços', href: '#precos' },
    { label: 'Roadmap', href: '#' },
    { label: 'Status', href: '#' },
  ],
  empresa: [
    { label: 'Sobre', href: '/sobre' },
    { label: 'Blog', href: '#' },
    { label: 'Contato', href: '/contato' },
    { label: 'Carreiras', href: '#' },
  ],
  legal: [
    { label: 'Termos de uso', href: '/legal/termos' },
    { label: 'Privacidade', href: '/legal/privacidade' },
    { label: 'LGPD', href: '/legal/lgpd' },
  ],
}
