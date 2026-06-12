'use client'

/**
 * app/admin/backtest/_components/ExaustivoView.tsx
 *
 * BACKTEST EXAUSTIVO (SUPERADMIN). Consome GET /api/admin/backtest-v2?grao=…
 * e renderiza:
 *  - Botão "Rodar backtest exaustivo (testar todos os formatos)".
 *  - DESTAQUE da melhor config encontrada (fatores, horizonte, acerto OOS,
 *    retorno, ganho vs baseline V1), com card verde.
 *  - RANKING (tabela) das top configs testadas, ordenado por acerto OOS desc,
 *    com a melhor destacada em verde.
 *  - Texto explicando o walk-forward (out-of-sample) e quantos combos rodaram.
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
  KPICard,
  EmptyState,
  DenseTable,
} from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { Layers, Play, AlertTriangle, Clock, Trophy } from 'lucide-react'

// ── Tipos do payload (espelham lib/backtest/engine-v2.ts) ───────────────────

interface ConfigGrid {
  horizonte: number
  fatores: string[]
  taxaAcertoOOS: number
  retornoOOS: number
  ganhoVsBaseline: number
}

interface RankingItem {
  horizonte: number
  fatores: string // 'preco_vs_media+sazonal+…'
  taxaAcertoOOS: number
  retornoOOS: number
}

interface RespostaV2 {
  grao?: string
  melhor?: ConfigGrid
  ranking?: RankingItem[]
  totalCombos?: number
  pontos?: number
  fontesOk?: {
    precoFisico: boolean
    cbot: boolean
    cambio: boolean
    cot: boolean
  }
  baselineV1?: { taxaAcerto: number }
  geradoEm?: string
  erro?: string
}

// ── Helpers de formatação ───────────────────────────────────────────────────

function fmtPct(n: number | undefined, casas = 1): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  const s = n.toFixed(casas)
  return `${n > 0 ? '+' : ''}${s}%`
}

function fmtPctSimples(n: number | undefined, casas = 1): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return `${n.toFixed(casas)}%`
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
  preco_vs_media: 'Preço vs média',
  cbot_tendencia: 'Tendência CBOT',
  sazonal: 'Sazonalidade',
  cot_extremo: 'COT extremo',
  carry: 'Carry (term-structure)',
  momentum: 'Momentum CBOT',
}

function rotuloFator(nome: string): string {
  return ROTULO_FATOR[nome] ?? nome
}

/** Combinação 'a+b+c' → rótulos legíveis 'A · B · C'. */
function rotuloCombo(fatores: string): string {
  if (!fatores) return '—'
  return fatores
    .split('+')
    .map((f) => rotuloFator(f))
    .join(' · ')
}

const MENSAGEM_ERRO: Record<string, string> = {
  sem_serie_preco:
    'Série gabarito (preço físico IPEA/DERAL) indisponível no momento — não é possível rodar o backtest exaustivo. Tente novamente.',
  serie_insuficiente:
    'Histórico alinhado insuficiente para o grid search walk-forward. As fontes podem estar temporariamente indisponíveis; tente novamente.',
  falha_inesperada:
    'Falha inesperada ao montar o backtest exaustivo. Tente novamente em instantes.',
}

// ── Componente ──────────────────────────────────────────────────────────────

export function ExaustivoView() {
  const [grao, setGrao] = React.useState<'soja' | 'milho'>('soja')
  const [carregando, setCarregando] = React.useState(false)
  const [erroRede, setErroRede] = React.useState<string | null>(null)
  const [dados, setDados] = React.useState<RespostaV2 | null>(null)

  const rodar = React.useCallback(async () => {
    setCarregando(true)
    setErroRede(null)
    try {
      const res = await fetch(`/api/admin/backtest-v2?grao=${grao}`, {
        cache: 'no-store',
      })
      if (res.status === 403 || res.status === 401) {
        setErroRede('Acesso restrito a superadministradores.')
        setDados(null)
        return
      }
      const json: RespostaV2 = await res.json()
      setDados(json)
    } catch {
      setErroRede('Não foi possível contatar o servidor. Verifique a conexão.')
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [grao])

  const melhor = dados?.melhor
  const ranking = dados?.ranking
  const erroDados = dados?.erro
  const baselineV1 = dados?.baselineV1?.taxaAcerto ?? 50

  const ganhoVsV1 =
    melhor && Number.isFinite(melhor.taxaAcertoOOS)
      ? melhor.taxaAcertoOOS - baselineV1
      : 0
  const acertoForte = (melhor?.taxaAcertoOOS ?? 0) > 60

  // ── Colunas do ranking ──────────────────────────────────────────────────────
  const colunasRanking: DenseTableColumn<RankingItem & { _melhor?: boolean }>[] = [
    {
      key: 'fatores',
      header: 'Combinação de fatores',
      accessor: (r) =>
        r._melhor ? (
          <span className="inline-flex items-center gap-2">
            <Trophy
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--success)' }}
              aria-label="melhor configuração"
            />
            <span
              className="text-fg-1 font-medium"
              style={{ color: 'var(--success)' }}
            >
              {rotuloCombo(r.fatores)}
            </span>
          </span>
        ) : (
          <span className="text-fg-2">{rotuloCombo(r.fatores)}</span>
        ),
    },
    {
      key: 'horizonte',
      header: 'Horizonte',
      align: 'right',
      isNumeric: true,
      accessor: (r) => (
        <span className="text-fg-3">
          {r.horizonte} {r.horizonte === 1 ? 'mês' : 'meses'}
        </span>
      ),
    },
    {
      key: 'acerto',
      header: 'Acerto OOS',
      align: 'right',
      isNumeric: true,
      accessor: (r) => (
        <Chip
          variant={
            r.taxaAcertoOOS >= 60 ? 'pos' : r.taxaAcertoOOS >= 50 ? 'warn' : 'neg'
          }
        >
          {r.taxaAcertoOOS.toFixed(1)}%
        </Chip>
      ),
    },
    {
      key: 'retorno',
      header: 'Retorno',
      align: 'right',
      isNumeric: true,
      accessor: (r) => (
        <span
          style={{
            color:
              r.retornoOOS > 0
                ? 'var(--success)'
                : r.retornoOOS < 0
                  ? 'var(--danger)'
                  : undefined,
          }}
        >
          {fmtPct(r.retornoOOS)}
        </span>
      ),
    },
  ]

  // A melhor config é a 1ª do ranking (já ordenado desc pelo motor). Marcamos
  // a linha correspondente para destacá-la em verde.
  const linhasRanking = React.useMemo(() => {
    if (!ranking) return []
    return ranking.map((r, i) => ({ ...r, _melhor: i === 0 }))
  }, [ranking])

  return (
    <div className="space-y-6">
      {/* ── Controles ─────────────────────────────────────────────────────── */}
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
          <Button
            variant="primary"
            leftIcon={<Play className="h-4 w-4" />}
            loading={carregando}
            onClick={rodar}
          >
            Rodar backtest exaustivo (testar todos os formatos)
          </Button>
          {dados?.geradoEm ? (
            <Chip
              variant="neutral"
              leftIcon={<Clock className="h-3.5 w-3.5" />}
              className="ml-auto"
            >
              Rodado em {fmtDataHora(dados.geradoEm)}
            </Chip>
          ) : null}
        </div>
      </Card>

      {/* ── Estados: erro de rede / erro de dados / inicial ────────────────── */}
      {erroRede ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível rodar o backtest exaustivo"
          description={erroRede}
        />
      ) : erroDados ? (
        <EmptyState
          icon={AlertTriangle}
          title="Dados indisponíveis"
          description={
            MENSAGEM_ERRO[erroDados] ??
            'Não foi possível concluir o backtest exaustivo com os dados atuais.'
          }
        />
      ) : !dados ? (
        <EmptyState
          icon={Layers}
          title="Nenhum backtest exaustivo rodado ainda"
          description="Selecione o grão e clique em “Rodar backtest exaustivo” para testar TODAS as combinações de fatores × horizontes em walk-forward (out-of-sample) e descobrir o formato mais assertivo."
        />
      ) : melhor && (melhor.fatores?.length ?? 0) > 0 ? (
        <>
          {/* ── Destaque da MELHOR config ────────────────────────────────── */}
          <Card
            style={{
              borderColor: acertoForte ? 'var(--success)' : undefined,
              borderWidth: acertoForte ? 1.5 : undefined,
            }}
          >
            <CardHeader>
              <CardTitle eyebrow="Melhor configuração encontrada">
                <span className="inline-flex items-center gap-2">
                  <Trophy
                    className="h-5 w-5"
                    style={{ color: 'var(--gold)' }}
                    aria-hidden
                  />
                  {rotuloCombo(melhor.fatores.join('+'))}
                </span>
              </CardTitle>
              <Chip variant={acertoForte ? 'pos' : 'neutral'}>
                Horizonte {melhor.horizonte}{' '}
                {melhor.horizonte === 1 ? 'mês' : 'meses'}
              </Chip>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  eyebrow="Acerto out-of-sample"
                  value={fmtPctSimples(melhor.taxaAcertoOOS)}
                  highlightValue={acertoForte}
                  subtitle="Walk-forward — sinais nunca vistos no treino"
                  delta={{
                    value: acertoForte ? 'forte' : 'moderado',
                    trend: acertoForte ? 'pos' : 'neutral',
                  }}
                />
                <KPICard
                  eyebrow="Retorno do sinal"
                  value={fmtPct(melhor.retornoOOS)}
                  highlightValue={melhor.retornoOOS > 0}
                  subtitle="Retorno médio out-of-sample por sinal"
                  delta={{
                    value: melhor.retornoOOS > 0 ? 'positivo' : 'negativo',
                    trend: melhor.retornoOOS > 0 ? 'pos' : 'neg',
                  }}
                />
                <KPICard
                  eyebrow="Ganho vs baseline V1"
                  value={`${ganhoVsV1 > 0 ? '+' : ''}${ganhoVsV1.toFixed(1)} pp`}
                  highlightValue={ganhoVsV1 > 0}
                  subtitle={`Baseline V1: ${baselineV1.toFixed(0)}% de acerto`}
                  delta={{
                    value: ganhoVsV1 > 0 ? 'superou' : 'abaixo',
                    trend: ganhoVsV1 > 0 ? 'pos' : 'neg',
                  }}
                />
                <KPICard
                  eyebrow="Ganho de retorno"
                  value={fmtPct(melhor.ganhoVsBaseline)}
                  highlightValue={melhor.ganhoVsBaseline > 0}
                  subtitle="vs vender todo mês (baseline)"
                  delta={{
                    value: melhor.ganhoVsBaseline > 0 ? 'acima' : 'abaixo',
                    trend: melhor.ganhoVsBaseline > 0 ? 'pos' : 'neg',
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* ── Explicação do método ──────────────────────────────────────── */}
          <Card>
            <CardBody>
              <p className="text-fg-2 text-small">
                Foram testadas{' '}
                <span className="text-accent font-medium">
                  {dados.totalCombos ?? 0} configurações
                </span>{' '}
                (combinações de fatores × horizontes de 1 a 3 meses) em{' '}
                <span className="text-fg-1 font-medium">walk-forward</span>: cada
                configuração é calibrada com os dados do passado (in-sample) e
                medida apenas em meses futuros que ela nunca viu (out-of-sample),
                sobre {dados.pontos ?? 0} meses de série alinhada. Isso evita
                overfit e estima a assertividade REAL — a taxa que se esperaria ao
                operar com a configuração daqui para frente.
              </p>
            </CardBody>
          </Card>

          {/* ── Ranking ───────────────────────────────────────────────────── */}
          <Card className="p-0">
            <CardHeader className="px-5 pt-5 mb-0">
              <CardTitle eyebrow="Ranking">
                Melhores configurações testadas
              </CardTitle>
            </CardHeader>
            <div className="px-5 pb-1 pt-1">
              <p className="text-fg-3 text-small mb-3">
                Top configurações por taxa de acerto out-of-sample (desc). A
                melhor está destacada em verde.
              </p>
            </div>
            <DenseTable
              columns={colunasRanking}
              rows={linhasRanking}
              rowKey={(r) => `${r.fatores}|${r.horizonte}`}
              empty="Nenhuma configuração com sinais suficientes no período."
              className="border-0 shadow-none"
            />
          </Card>
        </>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="Sem configuração vencedora"
          description="O grid search não encontrou nenhuma configuração com sinais suficientes. As fontes externas podem estar temporariamente indisponíveis; tente novamente."
        />
      )}
    </div>
  )
}
