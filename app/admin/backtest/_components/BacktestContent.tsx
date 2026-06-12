'use client'

/**
 * app/admin/backtest/_components/BacktestContent.tsx
 *
 * Painel do BACKTEST da inteligência (SUPERADMIN). Consome
 * GET /api/admin/backtest?grao=soja|milho&horizonte=1|2|3 e renderiza:
 *  - Controles: seletor de grão, horizonte e botão "Rodar backtest".
 *  - KPIs grandes: taxa de acerto (verde >60%), retorno do sinal vs baseline,
 *    ganho vs baseline e melhor horizonte (da calibração).
 *  - Tabela de ATRIBUIÇÃO por fator (quais sinais mais acertaram), ordenada
 *    por taxa de acerto desc.
 *  - Timeline mês a mês (mês, recomendação, preço no mês, preço futuro,
 *    variação, ✓/✗) com cor por acerto.
 *  - Bloco de CALIBRAÇÃO com os pesos sugeridos.
 *  - Chip "rodado em DD/MM HH:mm".
 *
 * Best-effort: o endpoint sempre responde 200; aqui tratamos loading, erro de
 * rede e respostas de erro de dados ({ erro }) sem quebrar a tela.
 */

import * as React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Chip,
  Select,
  Tabs,
  KPICard,
  EmptyState,
  DenseTable,
} from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import {
  FlaskConical,
  Play,
  AlertTriangle,
  Check,
  X,
  Clock,
} from 'lucide-react'
import { ExaustivoView } from './ExaustivoView'

// ── Tipos do payload (espelham lib/backtest/engine.ts) ──────────────────────

type Recomendacao = 'vender' | 'segurar' | 'esperar'

interface AtribuicaoFator {
  nome: string
  acertos: number
  total: number
  taxaAcerto: number
}

interface DetalheBacktest {
  mes: string
  rec: Recomendacao
  precoNoMes: number
  precoFuturo: number
  variacaoPct: number
  acertou: boolean
}

interface ResultadoBacktest {
  grao: string
  horizonteMeses: number
  totalSinais: number
  acertos: number
  taxaAcerto: number
  retornoMedioSinal: number
  retornoBaseline: number
  ganhoVsBaseline: number
  porFator: AtribuicaoFator[]
  detalhe: DetalheBacktest[]
}

interface Calibracao {
  pesos: Record<string, number>
  melhorHorizonte: number
  taxaAcertoCalibrada: number
}

interface RespostaBacktest {
  grao?: string
  horizonte?: number
  anos?: number
  pontos?: number
  resultado?: ResultadoBacktest
  calibracao?: Calibracao
  geradoEm?: string
  erro?: string
}

// ── Helpers de formatação ───────────────────────────────────────────────────

function fmtPct(n: number, casas = 1): string {
  if (!Number.isFinite(n)) return '—'
  const s = n.toFixed(casas)
  return `${n > 0 ? '+' : ''}${s}%`
}

function fmtReais(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtMesIso(mes: string): string {
  // 'YYYY-MM' → 'MM/YYYY'
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  return m ? `${m[2]}/${m[1]}` : mes
}

function fmtDataHora(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ROTULO_FATOR: Record<string, string> = {
  preco_vs_media: 'Preço vs média móvel',
  dolar_proj: 'Dólar projetado (Focus)',
  cbot_tendencia: 'Tendência CBOT',
  estoque_usda: 'Estoque USDA',
}

const ROTULO_REC: Record<Recomendacao, string> = {
  vender: 'Vender',
  segurar: 'Segurar',
  esperar: 'Esperar',
}

function rotuloFator(nome: string): string {
  return ROTULO_FATOR[nome] ?? nome
}

const MENSAGEM_ERRO: Record<string, string> = {
  sem_serie_preco:
    'Série gabarito (preço físico IPEA/DERAL) indisponível no momento — não é possível rodar o backtest. Tente novamente.',
  serie_insuficiente:
    'Histórico insuficiente para o horizonte selecionado. Reduza o horizonte e tente de novo.',
  falha_inesperada:
    'Falha inesperada ao montar o backtest. Tente novamente em instantes.',
}

// ── Componente ──────────────────────────────────────────────────────────────

/**
 * Wrapper com abas: alterna entre o backtest CLÁSSICO (V1, horizonte fixo) e o
 * EXAUSTIVO (V2, grid search walk-forward sobre todas as combinações).
 */
export function BacktestContent() {
  const [aba, setAba] = React.useState<'classico' | 'exaustivo'>('classico')

  return (
    <div className="space-y-6">
      <Tabs
        options={[
          { value: 'classico', label: 'Clássico' },
          { value: 'exaustivo', label: 'Exaustivo (todos os formatos)' },
        ]}
        value={aba}
        onChange={(v) => setAba(v as 'classico' | 'exaustivo')}
      />
      {aba === 'classico' ? <BacktestClassico /> : <ExaustivoView />}
    </div>
  )
}

function BacktestClassico() {
  const [grao, setGrao] = React.useState<'soja' | 'milho'>('soja')
  const [horizonte, setHorizonte] = React.useState<'1' | '2' | '3'>('2')
  const [carregando, setCarregando] = React.useState(false)
  const [erroRede, setErroRede] = React.useState<string | null>(null)
  const [dados, setDados] = React.useState<RespostaBacktest | null>(null)

  const rodar = React.useCallback(async () => {
    setCarregando(true)
    setErroRede(null)
    try {
      const res = await fetch(
        `/api/admin/backtest?grao=${grao}&horizonte=${horizonte}`,
        { cache: 'no-store' },
      )
      if (res.status === 403 || res.status === 401) {
        setErroRede('Acesso restrito a superadministradores.')
        setDados(null)
        return
      }
      const json: RespostaBacktest = await res.json()
      setDados(json)
    } catch {
      setErroRede('Não foi possível contatar o servidor. Verifique a conexão.')
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [grao, horizonte])

  const resultado = dados?.resultado
  const calibracao = dados?.calibracao
  const erroDados = dados?.erro

  // Atribuição ordenada por taxa de acerto desc.
  const fatoresOrdenados = React.useMemo<AtribuicaoFator[]>(() => {
    if (!resultado) return []
    return [...resultado.porFator].sort((a, b) => b.taxaAcerto - a.taxaAcerto)
  }, [resultado])

  const pesosOrdenados = React.useMemo<[string, number][]>(() => {
    if (!calibracao) return []
    return Object.entries(calibracao.pesos).sort((a, b) => b[1] - a[1])
  }, [calibracao])

  // ── Colunas: atribuição por fator ──────────────────────────────────────────
  const colunasFator: DenseTableColumn<AtribuicaoFator>[] = [
    {
      key: 'nome',
      header: 'Fator / sinal',
      accessor: (f) => <span className="text-fg-1">{rotuloFator(f.nome)}</span>,
    },
    {
      key: 'taxa',
      header: 'Acerto',
      align: 'right',
      isNumeric: true,
      accessor: (f) => (
        <Chip variant={f.taxaAcerto >= 60 ? 'pos' : f.taxaAcerto >= 50 ? 'warn' : 'neg'}>
          {f.taxaAcerto.toFixed(1)}%
        </Chip>
      ),
    },
    {
      key: 'amostra',
      header: 'Acertos / total',
      align: 'right',
      isNumeric: true,
      accessor: (f) => (
        <span className="text-fg-3">
          {f.acertos} / {f.total}
        </span>
      ),
    },
  ]

  // ── Colunas: timeline mês a mês ────────────────────────────────────────────
  const colunasDetalhe: DenseTableColumn<DetalheBacktest>[] = [
    {
      key: 'mes',
      header: 'Mês',
      isNumeric: true,
      accessor: (d) => <span className="text-fg-2">{fmtMesIso(d.mes)}</span>,
    },
    {
      key: 'rec',
      header: 'Recomendação',
      accessor: (d) => (
        <Chip variant={d.rec === 'vender' ? 'warn' : 'info'}>
          {ROTULO_REC[d.rec]}
        </Chip>
      ),
    },
    {
      key: 'precoNoMes',
      header: 'Preço no mês',
      align: 'right',
      isNumeric: true,
      accessor: (d) => <span className="text-fg-1">{fmtReais(d.precoNoMes)}</span>,
    },
    {
      key: 'precoFuturo',
      header: 'Preço futuro',
      align: 'right',
      isNumeric: true,
      accessor: (d) => <span className="text-fg-2">{fmtReais(d.precoFuturo)}</span>,
    },
    {
      key: 'variacao',
      header: 'Variação',
      align: 'right',
      isNumeric: true,
      accessor: (d) => (
        <span style={{ color: d.variacaoPct > 0 ? 'var(--success)' : d.variacaoPct < 0 ? 'var(--danger)' : undefined }}>
          {fmtPct(d.variacaoPct)}
        </span>
      ),
    },
    {
      key: 'acertou',
      header: 'Acerto',
      align: 'center',
      accessor: (d) =>
        d.acertou ? (
          <Check className="inline h-4 w-4" style={{ color: 'var(--success)' }} aria-label="acertou" />
        ) : (
          <X className="inline h-4 w-4" style={{ color: 'var(--danger)' }} aria-label="errou" />
        ),
    },
  ]

  const taxa = resultado?.taxaAcerto ?? 0
  const taxaVerde = taxa > 60

  return (
    <div className="space-y-6">
      {/* ── Controles ───────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Grão"
            value={grao}
            onChange={(e) => setGrao(e.target.value as 'soja' | 'milho')}
            options={[
              { value: 'soja', label: 'Soja' },
              { value: 'milho', label: 'Milho' },
            ]}
            containerClassName="min-w-[160px]"
          />
          <Select
            label="Horizonte"
            value={horizonte}
            onChange={(e) => setHorizonte(e.target.value as '1' | '2' | '3')}
            options={[
              { value: '1', label: '1 mês à frente' },
              { value: '2', label: '2 meses à frente' },
              { value: '3', label: '3 meses à frente' },
            ]}
            containerClassName="min-w-[180px]"
          />
          <Button
            variant="primary"
            leftIcon={<Play className="h-4 w-4" />}
            loading={carregando}
            onClick={rodar}
          >
            Rodar backtest
          </Button>
          {dados?.geradoEm ? (
            <Chip variant="neutral" leftIcon={<Clock className="h-3.5 w-3.5" />} className="ml-auto">
              Rodado em {fmtDataHora(dados.geradoEm)}
            </Chip>
          ) : null}
        </div>
      </Card>

      {/* ── Estados: erro de rede / erro de dados / inicial ──────────────── */}
      {erroRede ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível rodar o backtest"
          description={erroRede}
        />
      ) : erroDados ? (
        <EmptyState
          icon={AlertTriangle}
          title="Dados indisponíveis"
          description={MENSAGEM_ERRO[erroDados] ?? 'Não foi possível concluir o backtest com os dados atuais.'}
        />
      ) : !dados ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum backtest rodado ainda"
          description="Selecione o grão e o horizonte e clique em “Rodar backtest” para validar a inteligência contra o preço físico histórico."
        />
      ) : resultado ? (
        <>
          {/* ── KPIs ──────────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              eyebrow="Taxa de acerto"
              value={`${taxa.toFixed(1)}%`}
              highlightValue={taxaVerde}
              subtitle={`${resultado.acertos} de ${resultado.totalSinais} sinais · ${dados.pontos ?? 0} meses`}
              delta={{
                value: taxaVerde ? 'forte' : 'fraco',
                trend: taxaVerde ? 'pos' : 'neg',
              }}
            />
            <KPICard
              eyebrow="Retorno do sinal"
              value={fmtPct(resultado.retornoMedioSinal)}
              subtitle={`Baseline (vender sempre): ${fmtPct(resultado.retornoBaseline)}`}
              delta={{
                value: 'vs baseline',
                trend: 'neutral',
              }}
            />
            <KPICard
              eyebrow="Ganho vs baseline"
              value={fmtPct(resultado.ganhoVsBaseline)}
              highlightValue={resultado.ganhoVsBaseline > 0}
              subtitle="Pontos percentuais de retorno acima de vender todo mês"
              delta={{
                value: resultado.ganhoVsBaseline > 0 ? 'positivo' : 'negativo',
                trend: resultado.ganhoVsBaseline > 0 ? 'pos' : 'neg',
              }}
            />
            <KPICard
              eyebrow="Melhor horizonte"
              value={calibracao ? `${calibracao.melhorHorizonte} ${calibracao.melhorHorizonte === 1 ? 'mês' : 'meses'}` : '—'}
              subtitle={
                calibracao
                  ? `Acerto calibrado: ${calibracao.taxaAcertoCalibrada.toFixed(1)}%`
                  : 'Calibração indisponível'
              }
              delta={{
                value: 'calibrado',
                trend: 'neutral',
              }}
            />
          </div>

          {/* ── Atribuição por fator ──────────────────────────────────── */}
          <Card className="p-0">
            <CardHeader className="px-5 pt-5 mb-0">
              <CardTitle eyebrow="Atribuição">Quais sinais mais acertaram</CardTitle>
            </CardHeader>
            <div className="px-5 pb-1 pt-1">
              <p className="text-fg-3 text-small mb-3">
                Taxa de acerto por fator do agregador no horizonte de {resultado.horizonteMeses}{' '}
                {resultado.horizonteMeses === 1 ? 'mês' : 'meses'} — base para a calibração de pesos.
              </p>
            </div>
            <DenseTable
              columns={colunasFator}
              rows={fatoresOrdenados}
              rowKey={(f) => f.nome}
              empty="Sem fatores com sinal relevante no período."
              className="border-0 shadow-none"
            />
          </Card>

          {/* ── Calibração ────────────────────────────────────────────── */}
          {calibracao ? (
            <Card>
              <CardHeader>
                <CardTitle eyebrow="Calibração">Pesos sugeridos pelo backtest</CardTitle>
                <Chip variant={calibracao.taxaAcertoCalibrada > 60 ? 'pos' : 'neutral'}>
                  {calibracao.taxaAcertoCalibrada.toFixed(1)}% calibrado · H={calibracao.melhorHorizonte}
                </Chip>
              </CardHeader>
              <CardBody>
                <p className="text-fg-3 text-small">
                  Combinação de pesos por fator que maximizou a taxa de acerto no grid search.
                  Aplique-a no agregador para dar mais peso aos sinais que mais acertaram.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                  {pesosOrdenados.map(([nome, peso]) => (
                    <div
                      key={nome}
                      className="rounded-md border border-border-1 bg-bg-2 px-4 py-3"
                    >
                      <p className="eyebrow">{rotuloFator(nome)}</p>
                      <p className="t-num-lg text-accent">{peso.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* ── Timeline mês a mês ────────────────────────────────────── */}
          <Card className="p-0">
            <CardHeader className="px-5 pt-5 mb-0">
              <CardTitle eyebrow="Histórico">Sinal mês a mês vs preço físico</CardTitle>
            </CardHeader>
            <div className="px-5 pb-1 pt-1">
              <p className="text-fg-3 text-small mb-3">
                Recomendação reconstruída com os dados disponíveis em cada mês, confrontada com a
                variação real do preço físico {resultado.horizonteMeses}{' '}
                {resultado.horizonteMeses === 1 ? 'mês' : 'meses'} à frente.
              </p>
            </div>
            <DenseTable
              columns={colunasDetalhe}
              rows={resultado.detalhe}
              rowKey={(d) => d.mes}
              empty="Sem meses avaliados no período."
              className="border-0 shadow-none"
            />
          </Card>
        </>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="Resultado vazio"
          description="O backtest não retornou resultado. Tente outro grão ou horizonte."
        />
      )}
    </div>
  )
}
