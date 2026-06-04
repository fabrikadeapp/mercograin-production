/**
 * @deprecated phb.ts — antiga biblioteca de mock para demos.
 *
 * Todos os arrays foram zerados/esvaziados para que produção nunca exiba
 * informação fictícia. Os exports permanecem (com mesmo type) para não
 * quebrar componentes; cada componente deve testar `array.length === 0` e
 * renderizar EmptyState quando não houver dado real.
 *
 * Não adicionar mais dados aqui. Para novos componentes, use EmptyState
 * direto de @/components/ui/phb.
 */

// ---------- Sparklines (linhas planas para "shape" sem informação) ----------
const FLAT = [0, 0, 0, 0, 0, 0, 0, 0]
export const SPARK_UP = FLAT
export const SPARK_DOWN = FLAT
export const SPARK_FLAT_UP = FLAT
export const SPARK_VOL = FLAT

// ---------- Markets / cotações ----------
export interface MarketRow {
  label: string
  value: string
  delta: { value: string; trend: 'pos' | 'neg' }
  sparklineData: number[]
}
export const MARKETS: MarketRow[] = []
export const SOJA_CURVE: { label: string; value: number }[] = []
export const SOJA_DETAIL_CURVE: { label: string; value: number }[] = []
export const META_PROGRESS: { label: string; pct: number }[] = []

// ---------- Dashboard KPIs ----------
export interface DashboardKpi {
  eyebrow: string
  delta?: { value: string; trend: 'pos' | 'neg' }
  value: string
  subtitle: string
  sparklineData: number[]
  sparklineColor: string
}
export const DASHBOARD_KPIS: DashboardKpi[] = []

export const DEMAND_GLOBAL: { label: string; value: string; amount: number; color: string }[] = []

// ---------- Contratos / propostas (vazios — uso real lê do banco) ----------
export interface TopContractRow {
  cliente: string
  uf: string
  tipo: string
  risco: number
  valor: string
}
export const TOP_CONTRACTS: TopContractRow[] = []

export const WATCHLIST_ITEMS: { id: string; ativo: string; valor: string; delta: string }[] = []
export const NEWS_ITEMS: { id: string; meta: string; title: string }[] = []
export const ALERTS: { id: string; severidade: string; texto: string }[] = []

export interface FxRow {
  par: string
  spot?: string
  preco: string
  delta: string
  trend: string
}
export const FX_CROSS: FxRow[] = []

export const PIPELINE_STAGES: { id: string; label: string; count: number }[] = []

export interface ContractRow {
  id: string
  numero: string
  cliente: string
  grao: 'soja' | 'milho' | 'trigo' | 'sorgo' | 'usd'
  volume: string
  preco: string
  total: string
  vence: string
  status: string
}
export const CONTRACTS: ContractRow[] = []

export type ClassifiedKind = 'compra' | 'venda'
export interface ClassifiedCard {
  id: string
  kind: ClassifiedKind
  produto: string
  preco: string
  cidade: string
  uf: string
}
export const CLASSIFIEDS: ClassifiedCard[] = []

// ---------- Cashflow ----------
export const CASHFLOW_KPIS: DashboardKpi[] = []
export const CASHFLOW_BARS: { label: string; value: number }[] = []
export const CASHFLOW_DONUT: { label: string; value: number; color: string }[] = []

export interface CashflowRow {
  id: string
  descricao: string
  doc?: string
  cliente?: string
  contrato?: string
  vencimento: string
  valor: number
  status: string
}
export const RECEIVABLES: CashflowRow[] = []
export const PAYABLES: CashflowRow[] = []

// ---------- Relatórios ----------
export const REPORT_KPIS: DashboardKpi[] = []
export const REVENUE_BARS: { label: string; value: number }[] = []

export interface TopClientRow {
  id: string
  nome: string
  receita: string
  contratos: number
}
export const TOP_CLIENTS: TopClientRow[] = []

export const ORIGIN_GRAINS: { label: string; pct: number; color: string }[] = []
export const SALES_CHANNELS: { label: string; pct: number; color: string }[] = []
