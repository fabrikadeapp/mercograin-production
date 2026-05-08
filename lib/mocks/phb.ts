// Mock data for PHB Grain pages — fidelity-first.
// TODO: integrar com API.

export const SPARK_UP = [
  18, 19, 19, 20, 21, 22, 22, 23, 24, 24, 25, 27, 28, 30, 32, 33, 34, 36, 38, 40,
]
export const SPARK_DOWN = [
  40, 38, 37, 36, 36, 35, 34, 34, 33, 32, 30, 29, 28, 28, 27, 26, 26, 25, 24, 22,
]
export const SPARK_FLAT_UP = [
  20, 21, 20, 22, 21, 23, 22, 24, 23, 25, 24, 26, 25, 27, 26, 28, 27, 29, 28, 30,
]
export const SPARK_VOL = [
  22, 24, 23, 26, 28, 27, 30, 32, 31, 34, 36, 35, 38, 40, 38, 41, 43, 42, 45, 47,
]

export const MARKETS = [
  {
    symbol: 'Soja',
    ticker: 'ZS · CBOT',
    unit: 'R$/sc 60kg',
    price: 'R$ 142,30',
    delta: { value: '+1,84%', trend: 'pos' as const },
    buy: '142,15',
    sell: '142,45',
    sparklineData: SPARK_UP,
    grainColor: 'soja' as const,
  },
  {
    symbol: 'Milho',
    ticker: 'ZC · CBOT',
    unit: 'R$/sc 60kg',
    price: 'R$ 62,45',
    delta: { value: '-0,72%', trend: 'neg' as const },
    buy: '62,30',
    sell: '62,60',
    sparklineData: SPARK_DOWN,
    grainColor: 'milho' as const,
  },
  {
    symbol: 'Trigo',
    ticker: 'ZW · CBOT',
    unit: 'R$/sc 60kg',
    price: 'R$ 84,10',
    delta: { value: '+0,12%', trend: 'pos' as const },
    buy: '83,95',
    sell: '84,25',
    sparklineData: SPARK_FLAT_UP,
    grainColor: 'trigo' as const,
  },
  {
    symbol: 'Dólar',
    ticker: 'USDBRL · Comercial',
    unit: '',
    price: 'R$ 5,1820',
    delta: { value: '-0,34%', trend: 'neg' as const },
    buy: '5,1810',
    sell: '5,1830',
    sparklineData: SPARK_DOWN,
    grainColor: 'usd' as const,
  },
]

export const SOJA_CURVE = [
  { label: 'Jan', value: 132.4 },
  { label: 'Fev', value: 134.1 },
  { label: 'Mar', value: 137.2 },
  { label: 'Abr', value: 140.6 },
  { label: 'Mai', value: 148.1 },
  { label: 'Jun', value: 144.2 },
  { label: 'Jul', value: 141.8 },
  { label: 'Ago', value: 142.3 },
]

export const META_PROGRESS = [
  { label: 'Soja · Comprada', value: 84, color: 'var(--accent)' },
  { label: 'Milho · Comprada', value: 62, color: 'var(--grain-milho)' },
  { label: 'Trigo · Comprada', value: 41, color: 'var(--grain-trigo)' },
  { label: 'Soja · Vendida', value: 71, color: 'var(--accent)' },
  { label: 'Milho · Vendida', value: 58, color: 'var(--grain-milho)' },
  { label: 'Margem por saca', value: 36, color: 'var(--grain-trigo)' },
]

export const DASHBOARD_KPIS = [
  {
    eyebrow: 'CONTATOS FEITOS',
    delta: { value: '+11,4%', trend: 'pos' as const },
    value: '4.218',
    subtitle: '+186 esta semana',
    sparklineData: SPARK_UP,
    sparklineColor: 'var(--accent)',
  },
  {
    eyebrow: 'CONTRATOS EMITIDOS',
    delta: { value: '+8,7%', trend: 'pos' as const },
    value: '312',
    subtitle: 'vs 287 mês passado',
    sparklineData: SPARK_VOL,
    sparklineColor: 'var(--accent)',
  },
  {
    eyebrow: 'CONTRATOS ASSINADOS',
    delta: { value: '+4,2%', trend: 'pos' as const },
    value: '194',
    subtitle: '62% taxa de conversão',
    sparklineData: SPARK_FLAT_UP,
    sparklineColor: 'var(--accent)',
  },
  {
    eyebrow: 'CONTRATOS FECHADOS',
    delta: { value: '-2,1%', trend: 'neg' as const },
    value: '148',
    subtitle: 'Tonelagem total 312k t',
    sparklineData: SPARK_DOWN,
    sparklineColor: 'var(--neg)',
  },
  {
    eyebrow: 'COMPRADO',
    value: '186k t',
    subtitle: '73% da meta da safra',
    sparklineData: SPARK_UP,
    sparklineColor: 'var(--accent)',
  },
]

export const DEMAND_GLOBAL = [
  { label: 'China', value: '58.420 t', amount: 58420, color: 'var(--neg)' },
  { label: 'União Europeia', value: '24.180 t', amount: 24180, color: 'var(--warn)' },
  { label: 'Argentina', value: '18.950 t', amount: 18950, color: 'var(--info)' },
  { label: 'Estados Unidos', value: '12.430 t', amount: 12430, color: 'var(--accent)' },
  { label: 'Índia', value: '8.610 t', amount: 8610, color: 'var(--grain-milho)' },
]

export interface TopContractRow {
  cliente: string
  uf: string
  tipo: string
  risco: number
  valor: string
}

export const TOP_CONTRACTS: TopContractRow[] = [
  { cliente: 'Sementes Horizonte', uf: 'SP', tipo: 'contrato físico', risco: 2, valor: 'R$ 2,67M' },
  { cliente: 'Agropecuária São João', uf: 'PR', tipo: 'contrato físico', risco: 3, valor: 'R$ 1,77M' },
  { cliente: 'Cooperativa Vale Verde', uf: 'MT', tipo: 'contrato físico', risco: 5, valor: 'R$ 1,42M' },
  { cliente: 'Fazenda Boa Vista', uf: 'GO', tipo: 'contrato físico', risco: 3, valor: 'R$ 0,71M' },
  { cliente: 'Grupo Triagri', uf: 'RS', tipo: 'contrato físico', risco: 2, valor: 'R$ 0,27M' },
]

// === Cotações ===

export const SOJA_DETAIL_CURVE = [
  { label: 'Set', value: 128.4 },
  { label: 'Out', value: 130.1 },
  { label: 'Nov', value: 132.5 },
  { label: 'Dez', value: 134.8 },
  { label: 'Jan', value: 136.2 },
  { label: 'Fev', value: 138.4 },
  { label: 'Mar', value: 137.9 },
  { label: 'Abr', value: 141.0 },
  { label: 'Mai', value: 148.1 },
  { label: 'Jun', value: 144.2 },
  { label: 'Jul', value: 141.8 },
  { label: 'Ago', value: 140.6 },
  { label: 'Set', value: 141.2 },
  { label: 'Out', value: 142.3 },
]

export const WATCHLIST_ITEMS = [
  { symbol: 'Soja', ticker: 'ZS', value: '142,30', delta: { value: '+1,84%', trend: 'pos' as const }, sparklineData: SPARK_UP },
  { symbol: 'Milho', ticker: 'ZC', value: '62,45', delta: { value: '-0,72%', trend: 'neg' as const }, sparklineData: SPARK_DOWN },
  { symbol: 'Trigo', ticker: 'ZW', value: '84,10', delta: { value: '+0,12%', trend: 'pos' as const }, sparklineData: SPARK_FLAT_UP },
  { symbol: 'Sorgo', ticker: 'ZG', value: '48,90', delta: { value: '+0,42%', trend: 'pos' as const }, sparklineData: SPARK_FLAT_UP },
  { symbol: 'Algodão', ticker: 'CT', value: '212,40', delta: { value: '-1,18%', trend: 'neg' as const }, sparklineData: SPARK_DOWN },
  { symbol: 'Café Arábica', ticker: 'KC', value: '1.842,00', delta: { value: '+2,31%', trend: 'pos' as const }, sparklineData: SPARK_UP },
  { symbol: 'Açúcar', ticker: 'SB', value: '84,30', delta: { value: '+0,84%', trend: 'pos' as const }, sparklineData: SPARK_FLAT_UP },
  { symbol: 'Dólar', ticker: 'USDBRL', value: '5,1820', delta: { value: '-0,34%', trend: 'neg' as const }, sparklineData: SPARK_DOWN },
]

export const NEWS_ITEMS = [
  { meta: 'há 7 min · CEPEA', title: 'USDA revisa estoque global de soja para 122,4 Mt' },
  { meta: 'há 14 min · CEPEA', title: 'China retoma compras após feriado da Lua' },
  { meta: 'há 21 min · CEPEA', title: 'Estiagem no MT pressiona prêmio FOB Paranaguá' },
  { meta: 'há 28 min · CEPEA', title: 'Dólar fecha em queda com fluxo cambial positivo' },
]

export const ALERTS = [
  { label: 'Soja > R$ 145', status: 'ativo', variant: 'neutral' as const },
  { label: 'Milho < R$ 60', status: 'ativo', variant: 'neutral' as const },
  { label: 'Trigo +3% em 24h', status: 'disparado', variant: 'warn' as const, iconColor: 'var(--warn)' },
  { label: 'Dólar < R$ 5,10', status: 'ativo', variant: 'neutral' as const },
]

export interface FxRow {
  par: string
  preco: string
  delta: string
  trend: 'pos' | 'neg'
}

export const FX_CROSS: FxRow[] = [
  { par: 'USD/BRL', preco: '5,1820', delta: '-0,34%', trend: 'neg' },
  { par: 'EUR/BRL', preco: '5,5910', delta: '+0,18%', trend: 'pos' },
  { par: 'CNY/BRL', preco: '0,7140', delta: '-0,42%', trend: 'neg' },
  { par: 'ARS/BRL', preco: '0,0058', delta: '-1,21%', trend: 'neg' },
]

// === Contratos ===

export const PIPELINE_STAGES = [
  { stage: 'EM PROSPECÇÃO', count: 84, percent: 28, total: 'R$ 4,8M', color: 'var(--info)' },
  { stage: 'COTAÇÃO ENVIADA', count: 62, percent: 21, total: 'R$ 3,9M', color: 'color-mix(in srgb, var(--info) 60%, var(--bg-3))' },
  { stage: 'EM NEGOCIAÇÃO', count: 48, percent: 16, total: 'R$ 5,2M', color: 'var(--warn)' },
  { stage: 'ASSINADO', count: 76, percent: 26, total: 'R$ 3,1M', color: 'var(--accent)' },
  { stage: 'FECHADO', count: 42, percent: 14, total: 'R$ 1,4M', color: 'var(--grain-usd)' },
]

import type { BadgeStatus, GrainVariant } from '@/components/ui/phb'

export interface ContractRow {
  numero: string
  cliente: string
  grao: GrainVariant
  volume: string
  preco: string
  total: string
  vence: string
  status: BadgeStatus
}

export const CONTRACTS: ContractRow[] = [
  { numero: '#CT-2841', cliente: 'Agropecuária São João', grao: 'soja', volume: '12.450', preco: '142,30', total: '1.771.635,00', vence: '12 Out', status: 'assinado' },
  { numero: '#CT-2840', cliente: 'Cooperativa Vale Verde', grao: 'milho', volume: '8.300', preco: '62,45', total: '518.335,00', vence: '18 Out', status: 'pendente' },
  { numero: '#CT-2839', cliente: 'Fazenda Boa Vista', grao: 'soja', volume: '5.000', preco: '141,80', total: '709.000,00', vence: '22 Out', status: 'assinado' },
  { numero: '#CT-2838', cliente: 'Grupo Triagri', grao: 'trigo', volume: '3.200', preco: '84,10', total: '269.120,00', vence: '25 Out', status: 'rascunho' },
  { numero: '#CT-2837', cliente: 'Sementes Horizonte', grao: 'soja', volume: '18.700', preco: '143,10', total: '2.676.000,00', vence: '02 Nov', status: 'fechado' },
  { numero: '#CT-2836', cliente: 'Tropical Grãos', grao: 'milho', volume: '4.800', preco: '62,80', total: '301.440,00', vence: '04 Nov', status: 'em-negociacao' },
  { numero: '#CT-2835', cliente: 'Estância Três Marias', grao: 'soja', volume: '9.200', preco: '142,90', total: '1.314.680,00', vence: '10 Nov', status: 'pendente' },
  { numero: '#CT-2834', cliente: 'Faz. Águas Claras', grao: 'trigo', volume: '2.400', preco: '83,90', total: '201.360,00', vence: '12 Nov', status: 'cancelado' },
]

// === Classificados ===

export type ClassifiedKind = 'compra' | 'venda'

export interface ClassifiedCard {
  kind: ClassifiedKind
  age: string
  title: string
  location: string
  volume: string
  price: string
  modal: string
  delta: { value: string; trend: 'pos' | 'neg' }
}

export const CLASSIFIEDS: ClassifiedCard[] = [
  { kind: 'venda', age: 'HÁ 2H', title: 'Soja em grão · Safra 24/25', location: 'Sorriso · MT', volume: '12.500 sc', price: 'R$ 142,50', modal: 'FOB', delta: { value: '+1,8%', trend: 'pos' } },
  { kind: 'compra', age: 'HÁ 4H', title: 'Milho amarelo Tipo 2', location: 'Cascavel · PR', volume: '8.200 sc', price: 'R$ 62,40', modal: 'CIF', delta: { value: '-0,4%', trend: 'neg' } },
  { kind: 'venda', age: 'HÁ 6H', title: 'Trigo CWAD Premium', location: 'Passo Fundo · RS', volume: '3.400 sc', price: 'R$ 84,80', modal: 'FOB', delta: { value: '+0,6%', trend: 'pos' } },
  { kind: 'venda', age: 'HÁ 8H', title: 'Soja convencional · não-OGM', location: 'Rio Verde · GO', volume: '6.800 sc', price: 'R$ 148,90', modal: 'FOB', delta: { value: '+2,4%', trend: 'pos' } },
  { kind: 'compra', age: 'HÁ 12H', title: 'Sorgo granífero', location: 'Uberlândia · MG', volume: '4.200 sc', price: 'R$ 48,60', modal: 'CIF', delta: { value: '+0,2%', trend: 'pos' } },
  { kind: 'venda', age: 'HÁ 18H', title: 'Milho safrinha', location: 'Sinop · MT', volume: '14.100 sc', price: 'R$ 61,80', modal: 'FOB', delta: { value: '-0,9%', trend: 'neg' } },
]

// === Fluxo de Caixa ===

export const CASHFLOW_KPIS = [
  { eyebrow: 'SALDO ATUAL', delta: { value: '+4,2%', trend: 'pos' as const }, value: 'R$ 8,42M', subtitle: 'Conta operacional + investimentos' },
  { eyebrow: 'A RECEBER (30D)', delta: { value: '+11,4%', trend: 'pos' as const }, value: 'R$ 5,18M', subtitle: '146 títulos · 12 atrasados' },
  { eyebrow: 'A PAGAR (30D)', delta: { value: '-3,1%', trend: 'neg' as const }, value: 'R$ 3,42M', subtitle: '89 compromissos · 4 vencidos' },
  { eyebrow: 'PROJEÇÃO 90D', delta: { value: '+8,7%', trend: 'pos' as const }, value: 'R$ 14,8M', subtitle: 'Cenário base · sem novos contratos', highlight: true },
]

export const CASHFLOW_BARS = [
  { label: 'Set 30', value: 1.2 },
  { label: 'Out 7', value: 1.8 },
  { label: 'Out 14', value: 2.1 },
  { label: 'Out 21', value: 1.6 },
  { label: 'Out 28', value: 2.4 },
  { label: 'Nov 4', value: 2.8 },
  { label: 'Nov 11', value: 2.2 },
  { label: 'Nov 18', value: 3.1 },
  { label: 'Nov 25', value: 2.9 },
  { label: 'Dez 2', value: 3.4 },
  { label: 'Dez 9', value: 3.8 },
  { label: 'Dez 16', value: 3.2 },
  { label: 'Jan 6', value: 4.1 },
  { label: 'Jan 13', value: 4.6 },
]

export const CASHFLOW_DONUT = [
  { label: 'Receita Soja', value: 7.1, color: 'var(--accent)' },
  { label: 'Receita Milho', value: 3.5, color: 'var(--grain-milho)' },
  { label: 'Receita Trigo', value: 2.4, color: 'var(--grain-trigo)' },
  { label: 'Outras receitas', value: 1.8, color: 'var(--info)' },
]

export interface CashflowRow {
  label: string
  ref: string
  vence: string
  valor: string
  status: string
  variant: 'pos' | 'neg' | 'warn' | 'neutral'
}

export const RECEIVABLES: CashflowRow[] = [
  { label: 'Agropecuária São João', ref: 'CT-2841', vence: 'Hoje', valor: 'R$ 412k', status: 'em dia', variant: 'pos' },
  { label: 'Cooperativa Vale Verde', ref: 'CT-2840', vence: 'Amanhã', valor: 'R$ 312k', status: 'em dia', variant: 'pos' },
  { label: 'Sementes Horizonte', ref: 'CT-2837', vence: '+3 dias', valor: 'R$ 580k', status: 'em dia', variant: 'pos' },
  { label: 'Estância Três Marias', ref: 'CT-2835', vence: '+5 dias', valor: 'R$ 318k', status: 'atenção', variant: 'warn' },
  { label: 'Tropical Grãos', ref: 'CT-2836', vence: '+7 dias', valor: 'R$ 198k', status: 'em dia', variant: 'pos' },
]

export const PAYABLES: CashflowRow[] = [
  { label: 'Frete · Transrodo Log.', ref: 'FT-1842', vence: 'Hoje', valor: 'R$ 184k', status: 'vencido', variant: 'neg' },
  { label: 'Armazenagem · CESP', ref: 'AM-0942', vence: 'Amanhã', valor: 'R$ 96k', status: 'agendado', variant: 'neutral' },
  { label: 'Insumos · Bayer', ref: 'NF-12842', vence: '+2 dias', valor: 'R$ 412k', status: 'agendado', variant: 'neutral' },
  { label: 'Folha · 38 funcionários', ref: 'FL-10/26', vence: '+5 dias', valor: 'R$ 318k', status: 'agendado', variant: 'neutral' },
  { label: 'Impostos · ICMS-ST', ref: 'GR-091026', vence: '+7 dias', valor: 'R$ 110k', status: 'atenção', variant: 'warn' },
]

// === Relatórios ===

export const REPORT_KPIS = [
  { eyebrow: 'RECEITA BRUTA', delta: { value: '+12,4%', trend: 'pos' as const }, value: 'R$ 48,2M', subtitle: 'vs R$ 42,9M na 23/24' },
  { eyebrow: 'MARGEM MÉDIA', delta: { value: '+1,2%', trend: 'pos' as const }, value: '9,8%', subtitle: 'meta da safra 8,5%' },
  { eyebrow: 'TONELAGEM TOTAL', delta: { value: '+6,8%', trend: 'pos' as const }, value: '312k t', subtitle: '64% soja · 28% milho · 8% trigo' },
  { eyebrow: 'TAXA DE INADIMPL.', delta: { value: '-0,3%', trend: 'pos' as const }, value: '0,84%', subtitle: 'benchmark setor 1,5%' },
]

export const REVENUE_BARS = [
  { label: 'Set', value: 3.1 },
  { label: 'Out', value: 3.4 },
  { label: 'Nov', value: 3.6 },
  { label: 'Dez', value: 3.9 },
  { label: 'Jan', value: 4.1 },
  { label: 'Fev', value: 4.0 },
  { label: 'Mar', value: 4.4 },
  { label: 'Abr', value: 4.6 },
  { label: 'Mai', value: 4.9 },
  { label: 'Jun', value: 5.1 },
  { label: 'Jul', value: 5.3 },
  { label: 'Ago', value: 5.6 },
]

export interface TopClientRow {
  name: string
  pct: number
  value: string
  color: string
}

export const TOP_CLIENTS: TopClientRow[] = [
  { name: 'Sementes Horizonte', pct: 100, value: 'R$ 8,2M', color: 'var(--accent)' },
  { name: 'Agropecuária São João', pct: 78, value: 'R$ 6,4M', color: 'var(--accent)' },
  { name: 'Coop. Vale Verde', pct: 60, value: 'R$ 4,9M', color: 'var(--accent)' },
  { name: 'Grupo Triagri', pct: 46, value: 'R$ 3,8M', color: 'var(--accent)' },
  { name: 'Tropical Grãos', pct: 35, value: 'R$ 2,9M', color: 'var(--accent)' },
  { name: 'Faz. Boa Vista', pct: 26, value: 'R$ 2,1M', color: 'var(--warn)' },
  { name: 'Estância 3 Marias', pct: 22, value: 'R$ 1,8M', color: 'var(--warn)' },
]

export const ORIGIN_GRAINS = [
  { label: 'MT — Mato Grosso', pct: 42, color: 'var(--grain-soja)' },
  { label: 'PR — Paraná', pct: 24, color: 'var(--grain-milho)' },
  { label: 'GO — Goiás', pct: 18, color: 'color-mix(in srgb, var(--grain-soja) 70%, var(--bg-3))' },
  { label: 'RS — Rio Grande', pct: 12, color: 'var(--grain-trigo)' },
  { label: 'MS — M. Sul', pct: 4, color: 'var(--info)' },
]

export const SALES_CHANNELS = [
  { label: 'Mesa direta', pct: 58, color: 'var(--accent)' },
  { label: 'WhatsApp Bot', pct: 18, color: 'var(--info)' },
  { label: 'Marketplace PHB', pct: 14, color: 'var(--warn)' },
  { label: 'Cooperativas', pct: 8, color: 'var(--grain-trigo)' },
  { label: 'Exportação direta', pct: 2, color: 'var(--grain-milho)' },
]
