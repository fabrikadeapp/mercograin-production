'use client'
import * as React from 'react'
import {
  Bell,
  Plus,
  TrendingUp,
  TrendingDown,
  Settings,
  Download,
} from 'lucide-react'
import {
  Button,
  IconButton,
  Chip,
  Badge,
  GrainBadge,
  Input,
  Select,
  SearchField,
  Tabs,
  Pill,
  Dialog,
  AppShell,
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  MarketCard,
  Sparkline,
  AreaChart,
  BarChart,
  Donut,
  ProgressBar,
  PipRow,
  DenseTable,
  WatchlistList,
  PaletteSwitcher,
  type DenseTableColumn,
} from '@/components/ui/phb'

const SPARK_UP = [12, 14, 13, 15, 16, 18, 17, 20, 22, 21, 24, 26]
const SPARK_DOWN = [40, 38, 39, 36, 35, 34, 33, 35, 32, 30, 28, 27]
const SPARK_NEUTRAL = [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17]
const SPARK_VOL = [8, 11, 9, 14, 10, 16, 12, 18, 14, 20, 17, 22]

const AREA_DATA = [
  { label: 'Jan', value: 32 },
  { label: 'Fev', value: 36 },
  { label: 'Mar', value: 35 },
  { label: 'Abr', value: 41 },
  { label: 'Mai', value: 44 },
  { label: 'Jun', value: 43 },
  { label: 'Jul', value: 48 },
  { label: 'Ago', value: 52 },
]

const BAR_DATA = [
  { label: 'S1', value: 22 },
  { label: 'S2', value: 28 },
  { label: 'S3', value: 25 },
  { label: 'S4', value: 31 },
  { label: 'S5', value: 36 },
  { label: 'S6', value: 33 },
  { label: 'S7', value: 41 },
]

const DONUT_DATA = [
  { label: 'Soja', value: 58, color: 'var(--grain-soja)' },
  { label: 'Milho', value: 24, color: 'var(--grain-milho)' },
  { label: 'Trigo', value: 12, color: 'var(--grain-trigo)' },
  { label: 'Outros', value: 6, color: 'var(--info)' },
]

interface ContractRow {
  id: string
  cliente: string
  graos: 'soja' | 'milho' | 'trigo'
  volume: string
  preco: string
  praca: string
  status: 'assinado' | 'pendente' | 'rascunho' | 'em-negociacao' | 'fechado'
  risco: number
}

const CONTRACT_ROWS: ContractRow[] = [
  {
    id: 'CT-2042',
    cliente: 'Agropecuária Vale Verde',
    graos: 'soja',
    volume: '12.450 sc',
    preco: 'R$ 142,30',
    praca: 'Paranaguá / PR',
    status: 'assinado',
    risco: 1,
  },
  {
    id: 'CT-2041',
    cliente: 'Coop. Centro-Oeste',
    graos: 'milho',
    volume: '28.910 sc',
    preco: 'R$ 68,40',
    praca: 'Itajaí / SC',
    status: 'pendente',
    risco: 3,
  },
  {
    id: 'CT-2040',
    cliente: 'Fazenda Três Rios',
    graos: 'trigo',
    volume: '6.200 sc',
    preco: 'R$ 88,10',
    praca: 'Rio Grande / RS',
    status: 'em-negociacao',
    risco: 2,
  },
  {
    id: 'CT-2039',
    cliente: 'Granja Boa Vista',
    graos: 'soja',
    volume: '4.800 sc',
    preco: 'R$ 141,90',
    praca: 'Santos / SP',
    status: 'rascunho',
    risco: 4,
  },
  {
    id: 'CT-2038',
    cliente: 'Cooperativa Sul',
    graos: 'milho',
    volume: '15.300 sc',
    preco: 'R$ 67,80',
    praca: 'Paranaguá / PR',
    status: 'fechado',
    risco: 5,
  },
]

const CONTRACT_COLUMNS: DenseTableColumn<ContractRow>[] = [
  {
    key: 'id',
    header: 'Contrato',
    accessor: (r) => <span className="font-mono tabular-nums text-fg-1">{r.id}</span>,
  },
  { key: 'cliente', header: 'Cliente', accessor: (r) => r.cliente },
  {
    key: 'graos',
    header: 'Grão',
    accessor: (r) => <GrainBadge variant={r.graos} />,
  },
  {
    key: 'volume',
    header: 'Volume',
    accessor: (r) => r.volume,
    isNumeric: true,
    align: 'right',
  },
  {
    key: 'preco',
    header: 'Preço',
    accessor: (r) => r.preco,
    isNumeric: true,
    align: 'right',
  },
  { key: 'praca', header: 'Praça', accessor: (r) => r.praca },
  {
    key: 'risco',
    header: 'Risco',
    align: 'center',
    accessor: (r) => <PipRow level={r.risco} size="sm" />,
  },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    accessor: (r) => <Badge variant={r.status} />,
  },
]

const WATCHLIST_ITEMS = [
  {
    symbol: 'Soja CBOT',
    ticker: 'ZS · CBOT',
    value: '14,82',
    delta: { value: '+1,2%', trend: 'pos' as const },
    sparklineData: SPARK_UP,
  },
  {
    symbol: 'Milho B3',
    ticker: 'CCM · B3',
    value: '68,40',
    delta: { value: '-0,4%', trend: 'neg' as const },
    sparklineData: SPARK_DOWN,
  },
  {
    symbol: 'Trigo CME',
    ticker: 'ZW · CME',
    value: '5,84',
    delta: { value: '+0,8%', trend: 'pos' as const },
    sparklineData: SPARK_NEUTRAL,
  },
  {
    symbol: 'USD/BRL',
    ticker: 'USD · PTAX',
    value: '5,1820',
    delta: { value: '-0,2%', trend: 'neg' as const },
    sparklineData: SPARK_DOWN,
  },
]

export default function Playground() {
  const [tab, setTab] = React.useState('todos')
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa de operações · Tempo real"
        title="Playground BH Grain"
        subtitle="Atualizado há 12s · CEPEA + B3 + USDA"
        actions={
          <>
            <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />}>
              Exportar
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KPICard
          eyebrow="RECEITA BRUTA"
          delta={{ value: '+11,4%', trend: 'pos' }}
          value="R$ 48,2M"
          subtitle="vs R$ 42,9M na 23/24"
          sparklineData={SPARK_UP}
          highlightValue
        />
        <KPICard
          eyebrow="VOLUME NEGOCIADO"
          delta={{ value: '+8,1%', trend: 'pos' }}
          value="312k sc"
          subtitle="vs 288k sc na 23/24"
          sparklineData={SPARK_VOL}
          sparklineColor="var(--grain-milho)"
        />
        <KPICard
          eyebrow="MARGEM MÉDIA"
          delta={{ value: '-1,2%', trend: 'neg' }}
          value="14,8%"
          subtitle="vs 16,0% na 23/24"
          sparklineData={SPARK_DOWN}
          sparklineColor="var(--neg)"
        />
        <KPICard
          eyebrow="CONTRATOS ATIVOS"
          delta={{ value: '0,0%', trend: 'neutral' }}
          value="142"
          subtitle="87 ativos · 55 arquivados"
          sparklineData={SPARK_NEUTRAL}
          sparklineColor="var(--info)"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MarketCard
          symbol="Soja"
          ticker="ZS · CBOT"
          unit="R$/sc 60kg"
          price="142,30"
          delta={{ value: '+1,2%', trend: 'pos' }}
          buy="142,10"
          sell="142,55"
          sparklineData={SPARK_UP}
          grainColor="soja"
        />
        <MarketCard
          symbol="Milho"
          ticker="CCM · B3"
          unit="R$/sc 60kg"
          price="68,40"
          delta={{ value: '-0,4%', trend: 'neg' }}
          buy="68,20"
          sell="68,55"
          sparklineData={SPARK_DOWN}
          grainColor="milho"
        />
        <MarketCard
          symbol="Trigo"
          ticker="ZW · CME"
          unit="R$/sc 60kg"
          price="88,10"
          delta={{ value: '+0,8%', trend: 'pos' }}
          buy="87,90"
          sell="88,40"
          sparklineData={SPARK_NEUTRAL}
          grainColor="trigo"
        />
        <MarketCard
          symbol="USD/BRL"
          ticker="USD · PTAX"
          unit="R$"
          price="5,1820"
          currency=""
          delta={{ value: '-0,2%', trend: 'neg' }}
          buy="5,1810"
          sell="5,1830"
          sparklineData={SPARK_DOWN}
          grainColor="usd"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle eyebrow="EVOLUÇÃO DE RECEITA">Receita bruta · 8m</CardTitle>
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'soja', label: 'Soja' },
                { value: 'milho', label: 'Milho' },
              ]}
            />
          </CardHeader>
          <AreaChart data={AREA_DATA} height={260} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle eyebrow="MIX DE GRÃOS">Composição</CardTitle>
          </CardHeader>
          <Donut data={DONUT_DATA} centerValue="58%" centerSubtitle="Soja" />
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="VOLUMES SEMANAIS">Sacas / semana</CardTitle>
          </CardHeader>
          <BarChart data={BAR_DATA} highlightLast height={220} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle eyebrow="METAS DE COLHEITA">Andamento</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <ProgressBar label="Soja" value={78} color="var(--grain-soja)" />
            <ProgressBar label="Milho" value={52} color="var(--grain-milho)" />
            <ProgressBar label="Trigo" value={31} color="var(--grain-trigo)" />
            <ProgressBar label="Sorgo" value={14} color="var(--accent)" size="sm" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle eyebrow="WATCHLIST">Mercado agora</CardTitle>
          </CardHeader>
          <WatchlistList items={WATCHLIST_ITEMS} />
        </Card>
      </section>

      <section className="mb-8">
        <DenseTable
          columns={CONTRACT_COLUMNS}
          rows={CONTRACT_ROWS}
          rowKey={(r) => r.id}
          onRowClick={() => undefined}
        />
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="PRIMITIVES">Buttons & badges</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Novo contrato</Button>
              <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>
                Adicionar lote
              </Button>
              <Button variant="ghost">Exportar PDF</Button>
              <Button size="sm">Sm</Button>
              <Button loading>Salvando</Button>
              <IconButton aria-label="Notificações" badge={3}>
                <Bell className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Configurações">
                <Settings className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip variant="pos" leftIcon={<TrendingUp className="h-3 w-3" />}>
                +11,4%
              </Chip>
              <Chip variant="neg" leftIcon={<TrendingDown className="h-3 w-3" />}>
                -8,6%
              </Chip>
              <Chip variant="warn">Atenção</Chip>
              <Chip variant="info">Info</Chip>
              <Chip variant="neutral">Neutro</Chip>
              <Chip variant="accent">Accent</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="assinado" />
              <Badge variant="pendente" />
              <Badge variant="rascunho" />
              <Badge variant="cancelado" />
              <Badge variant="fechado" />
              <Badge variant="em-negociacao" />
            </div>
            <div className="flex flex-wrap gap-2">
              <GrainBadge variant="soja" />
              <GrainBadge variant="milho" />
              <GrainBadge variant="trigo" />
              <GrainBadge variant="sorgo" />
              <GrainBadge variant="usd" />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Pill>Padrão</Pill>
              <Pill leftIcon={<Bell className="h-3 w-3" />}>Com ícone</Pill>
              <PipRow level={1} />
              <PipRow level={3} />
              <PipRow level={5} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle eyebrow="FORMS">Inputs</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Cliente" placeholder="Buscar cliente…" />
            <Input label="Volume" defaultValue="12.450" rightAddon="sacas" />
            <Select
              label="Praça"
              options={[
                { value: 'pr', label: 'Paranaguá / PR' },
                { value: 'sc', label: 'Itajaí / SC' },
              ]}
            />
          </div>
          <div className="mt-4">
            <SearchField placeholder="Buscar contratos, clientes, lotes…" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle eyebrow="DIALOG">Confirmação</CardTitle>
          </CardHeader>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Abrir diálogo
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Confirmar operação"
            description="Esta ação irá registrar um novo contrato no sistema."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirmar</Button>
              </>
            }
          >
            <p className="text-fg-2 text-body">
              Revise os detalhes antes de prosseguir. Você poderá editar até a assinatura final.
            </p>
          </Dialog>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle eyebrow="SPARKLINES">Standalone</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Sparkline data={SPARK_UP} />
            <Sparkline data={SPARK_DOWN} color="var(--neg)" />
            <Sparkline data={SPARK_NEUTRAL} color="var(--grain-trigo)" smooth={false} />
          </div>
        </Card>

        <Card className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-fg-2">Trocar paleta:</p>
          <PaletteSwitcher />
        </Card>
      </section>
    </AppShell>
  )
}
