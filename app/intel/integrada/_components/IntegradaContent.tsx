'use client'

/**
 * app/intel/integrada/_components/IntegradaContent.tsx
 *
 * VISÃO INTEGRADA: cruza a camada de PREÇO (simularPrecoGrao — fair value
 * CBOT/prêmios/praças) com o PANORAMA das 6 fontes (GET /api/intel/panorama)
 * para entregar um VEREDITO único: VENDER / SEGURAR / ESPERAR.
 *
 * Layout (grid que tenta caber na tela):
 *  - TOPO: veredito consolidado (recomendação + confiança histórica do
 *    backtest quando os sinais trazem `confianca`).
 *  - SEÇÃO PREÇO: mini-resumo das calculadoras (CBOT atual, fair value por
 *    praça, melhor trading) usando lib/cotacoes/simulador.ts.
 *  - SEÇÃO PANORAMA: chips de viés dos sinais das 6 fontes.
 *
 * Tudo best-effort: CBOT/câmbio vêm pré-carregados do servidor (props) e o
 * panorama é buscado no client; falhas degradam sem quebrar a tela.
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
} from '@/components/ui/phb'
import {
  Layers,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Gauge,
} from 'lucide-react'
import {
  simularPrecoGrao,
  simularPracas,
  simularTradings,
  type GraoSimulador,
} from '@/lib/cotacoes/simulador'
import type {
  PanoramaIntel,
  PanoramaSinal,
  Vies,
  Grao,
} from '@/lib/intel/agregador'

// ── Props (dados pré-carregados no servidor) ────────────────────────────────

export interface BaseIntegrada {
  /** CBOT front-month em ¢/bu por grão (null quando indisponível). */
  cbot: { soja: number | null; milho: number | null }
  /** Câmbio USD/BRL à vista. */
  cambio: number | null
  /** ISO da leitura de preço (banco ou ao vivo). */
  atualizadoEm: string | null
  /** Origem dos dados de preço (ex.: 'TradingView', 'ao vivo'). */
  fonteDados: string | null
}

interface RespostaPanorama {
  grao: Grao
  panorama: PanoramaIntel
  fontesOk: string[]
  fontesFalha: string[]
  geradoEm: string
}

// ── Premissas de praça/trading (mesmas defaults da mesa de originação) ───────
// Valores típicos de prêmio (US¢/bu) e frete (R$/saca) — servem de cenário
// ilustrativo do fair value por praça/comprador. Não são cotações negociadas.

const PRACAS_PADRAO = [
  { nome: 'Rondonópolis (MT)', fretePorSacaBrl: 22 },
  { nome: 'Sorriso (MT)', fretePorSacaBrl: 30 },
  { nome: 'Cascavel (PR)', fretePorSacaBrl: 12 },
  { nome: 'Rio Verde (GO)', fretePorSacaBrl: 18 },
]

const TRADINGS_PADRAO = [
  { nome: 'Trading A', premioCentavosBu: 80 },
  { nome: 'Trading B', premioCentavosBu: 60 },
  { nome: 'Trading C', premioCentavosBu: 45 },
]

const GRAOS: { value: string; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
]

// Prêmio de exportação de referência por grão (US¢/bu) e FOBBINGS (US$/t).
const PREMIO_REF: Record<GraoSimulador, number> = { soja: 70, milho: 50, trigo: 0 }
const FOBBINGS_REF = -10

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarBrasilia(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return '—'
  }
}

function fmtBrl(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function fmtNum(v: number | null | undefined, casas = 1, sufixo = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const s = v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
  return sufixo ? `${s} ${sufixo}` : s
}

// ── Veredito consolidado ─────────────────────────────────────────────────────

type Recomendacao = 'VENDER' | 'SEGURAR' | 'ESPERAR'

interface Veredito {
  recomendacao: Recomendacao
  /** Viés agregado das 6 fontes. */
  viesPanorama: Vies
  /** Saldo dos sinais (altista − baixista). */
  saldo: number
  /** Resumo textual do raciocínio. */
  racional: string
  /** Confiança histórica (se algum sinal trouxe `confianca` do backtest). */
  confianca: string | null
}

/**
 * Cruza o viés do panorama (oferta/demanda/câmbio das 6 fontes) com a
 * disponibilidade de fair value de preço para uma recomendação única:
 *  - Viés BAIXISTA (mais oferta / dólar caindo) → VENDER (trave preço já).
 *  - Viés ALTISTA (demanda / dólar subindo)     → SEGURAR (preço tende a subir).
 *  - Viés NEUTRO                                 → ESPERAR (sem gatilho claro).
 */
function calcularVeredito(panorama: PanoramaIntel | null): Veredito | null {
  if (!panorama) return null
  const sinais = panorama.sinais ?? []

  let altista = 0
  let baixista = 0
  for (const s of sinais) {
    if (s.vies === 'altista') altista += 1
    else if (s.vies === 'baixista') baixista += 1
  }
  const saldo = altista - baixista
  const viesPanorama: Vies =
    saldo > 0 ? 'altista' : saldo < 0 ? 'baixista' : 'neutro'

  let recomendacao: Recomendacao
  let racional: string
  if (viesPanorama === 'baixista') {
    recomendacao = 'VENDER'
    racional =
      'Predomínio de sinais baixistas (mais oferta / dólar em queda). Travar preço agora tende a ser melhor do que esperar.'
  } else if (viesPanorama === 'altista') {
    recomendacao = 'SEGURAR'
    racional =
      'Predomínio de sinais altistas (demanda firme / dólar em alta). O preço em R$ tende a subir — segurar a venda pode capturar mais valor.'
  } else {
    recomendacao = 'ESPERAR'
    racional =
      'Sinais equilibrados entre as fontes. Sem gatilho direcional claro — aguardar nova leitura antes de comprometer volume.'
  }

  // Confiança histórica: pega a maior do conjunto de sinais que casam com o viés.
  const relevantes = sinais.filter((s) => s.vies === viesPanorama && s.confianca)
  const confianca =
    relevantes.length > 0 ? (relevantes[0].confianca ?? null) : null

  return { recomendacao, viesPanorama, saldo, racional, confianca }
}

function chipVarianteVies(vies: Vies): 'pos' | 'neg' | 'neutral' {
  if (vies === 'altista') return 'pos'
  if (vies === 'baixista') return 'neg'
  return 'neutral'
}

/** Cor/ícone do veredito. */
function estiloRecomendacao(r: Recomendacao): {
  cor: string
  Icone: typeof TrendingUp
  variante: 'pos' | 'neg' | 'neutral'
} {
  if (r === 'VENDER')
    return { cor: 'var(--danger)', Icone: TrendingDown, variante: 'neg' }
  if (r === 'SEGURAR')
    return { cor: 'var(--success)', Icone: TrendingUp, variante: 'pos' }
  return { cor: 'var(--gold)', Icone: Minus, variante: 'neutral' }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Cartão do veredito consolidado no topo. */
function CardVeredito({
  veredito,
  carregando,
}: {
  veredito: Veredito | null
  carregando: boolean
}) {
  if (!veredito) {
    return (
      <Card>
        <CardHeader>
          <CardTitle eyebrow="Veredito consolidado">
            <span className="inline-flex items-center gap-2">
              <Gauge className="h-4 w-4 text-accent" />
              Análise Integrada
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-small text-fg-3">
            {carregando
              ? 'Consolidando preço e panorama…'
              : 'Sem dados suficientes para um veredito. Atualize o panorama.'}
          </p>
        </CardBody>
      </Card>
    )
  }

  const { cor, Icone, variante } = estiloRecomendacao(veredito.recomendacao)
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Veredito consolidado · preço × panorama</p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: cor, color: 'var(--bg-2)' }}
            >
              <Icone className="h-6 w-6" />
            </span>
            <span
              className="text-h1 font-semibold tracking-tight"
              style={{ color: cor }}
            >
              {veredito.recomendacao}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-body text-fg-2">
            {veredito.racional}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Chip
            variant={chipVarianteVies(veredito.viesPanorama)}
            leftIcon={
              veredito.viesPanorama === 'altista' ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : veredito.viesPanorama === 'baixista' ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )
            }
          >
            Panorama {veredito.viesPanorama}
          </Chip>
          <Chip variant={variante}>
            Saldo de sinais{' '}
            {veredito.saldo > 0 ? `+${veredito.saldo}` : veredito.saldo}
          </Chip>
          {veredito.confianca ? (
            <Chip variant="info" leftIcon={<Gauge className="h-3.5 w-3.5" />}>
              {veredito.confianca}
            </Chip>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/** Seção PREÇO: mini-resumo das calculadoras (CBOT, fair value, melhor trading). */
function SecaoPreco({
  grao,
  base,
}: {
  grao: GraoSimulador
  base: BaseIntegrada
}) {
  const cbotCents = grao === 'milho' ? base.cbot.milho : base.cbot.soja
  const cambio = base.cambio

  const calculo = React.useMemo(() => {
    if (cbotCents === null || cambio === null) return null
    const premio = PREMIO_REF[grao]
    // Fair value no porto (frete 0) como referência "porto".
    const noPorto = simularPrecoGrao({
      grao,
      cbotCentavosBu: cbotCents,
      premioCentavosBu: premio,
      fobbingsUsdTon: FOBBINGS_REF,
      cambioUsdBrl: cambio,
      fretePorSacaBrl: 0,
    })
    const pracas = simularPracas(
      {
        grao,
        cbotCentavosBu: cbotCents,
        premioCentavosBu: premio,
        fobbingsUsdTon: FOBBINGS_REF,
        cambioUsdBrl: cambio,
      },
      PRACAS_PADRAO,
    )
    const tradings = simularTradings(
      {
        grao,
        cbotCentavosBu: cbotCents,
        fobbingsUsdTon: FOBBINGS_REF,
        cambioUsdBrl: cambio,
        fretePorSacaBrl: 0,
      },
      TRADINGS_PADRAO,
    )
    return { noPorto, pracas, tradings, premio }
  }, [grao, cbotCents, cambio])

  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Camada de preço">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>💲</span>
            Fair value (CBOT → R$/saca)
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {calculo === null ? (
          <p className="text-small text-fg-3">
            CBOT ou câmbio indisponíveis nesta leitura — o fair value não pôde
            ser calculado. Tente atualizar em instantes.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KPICard
                eyebrow="CBOT atual"
                value={fmtNum(cbotCents, 2, '¢/bu')}
                subtitle={`Prêmio ref. ${PREMIO_REF[grao]}¢`}
              />
              <KPICard
                eyebrow="Câmbio USD/BRL"
                value={fmtNum(cambio, 4)}
                subtitle="à vista"
              />
              <KPICard
                eyebrow="Fair value porto"
                value={fmtBrl(calculo.noPorto.brlPorSacaPorto)}
                subtitle="R$/saca FOB porto"
                highlightValue
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="eyebrow mb-2">Fair value por praça (FOB origem)</p>
                <div className="space-y-0">
                  {calculo.pracas.map((p, i) => (
                    <div
                      key={p.nome}
                      className="flex items-center justify-between gap-3 border-b border-border-1 py-1.5 last:border-b-0"
                    >
                      <span className="truncate text-small text-fg-2">
                        {p.nome}
                      </span>
                      <span className="tabular-nums text-body font-medium text-fg-1">
                        {fmtBrl(p.brlPorSacaFobOrigem)}
                        {i === 0 ? (
                          <span className="ml-2 align-middle">
                            <Chip variant="pos">melhor</Chip>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">
                  Melhor trading (prêmio próprio, porto)
                </p>
                <div className="space-y-0">
                  {calculo.tradings.map((t, i) => (
                    <div
                      key={t.nome}
                      className="flex items-center justify-between gap-3 border-b border-border-1 py-1.5 last:border-b-0"
                    >
                      <span className="truncate text-small text-fg-2">
                        {t.nome} · {t.premioCentavosBu}¢
                      </span>
                      <span className="tabular-nums text-body font-medium text-fg-1">
                        {fmtBrl(t.brlPorSacaPorto)}
                        {i === 0 ? (
                          <span className="ml-2 align-middle">
                            <Chip variant="pos">paga mais</Chip>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-small text-fg-3">
              Cenário ilustrativo (prêmio/frete de referência da mesa). Para
              negociar, use a Calculadora de Mesa com seus prêmios e fretes
              reais.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  )
}

/** Seção PANORAMA: chips de viés dos sinais das 6 fontes. */
function SecaoPanorama({
  panorama,
  fontesOk,
  fontesFalha,
  carregando,
}: {
  panorama: PanoramaIntel | null
  fontesOk: string[]
  fontesFalha: string[]
  carregando: boolean
}) {
  const sinais: PanoramaSinal[] = panorama?.sinais ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Panorama das 6 fontes">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>🛰️</span>
            Sinais de viés (USDA · Focus · CONAB · câmbio)
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {carregando && !panorama ? (
          <p className="text-small text-fg-3">Consultando as fontes…</p>
        ) : sinais.length === 0 ? (
          <p className="text-small text-fg-3">
            Sem variações relevantes nas fontes para gerar sinais nesta leitura.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sinais.map((s, i) => {
              const Icone =
                s.vies === 'altista'
                  ? TrendingUp
                  : s.vies === 'baixista'
                    ? TrendingDown
                    : Minus
              return (
                <Chip
                  key={i}
                  variant={chipVarianteVies(s.vies)}
                  leftIcon={<Icone className="h-3.5 w-3.5" />}
                >
                  {s.texto}
                  {s.confianca ? ` · ${s.confianca}` : ''}
                </Chip>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {fontesOk.length > 0 ? (
            <Chip variant="pos" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              {fontesOk.length}{' '}
              {fontesOk.length === 1 ? 'fonte ok' : 'fontes ok'}
            </Chip>
          ) : null}
          {fontesFalha.length > 0 ? (
            <Chip variant="warn" leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}>
              {fontesFalha.length}{' '}
              {fontesFalha.length === 1 ? 'indisponível' : 'indisponíveis'}
            </Chip>
          ) : null}
          <a
            href="/intel"
            className="text-small text-accent underline-offset-2 hover:underline"
          >
            Ver panorama completo →
          </a>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function IntegradaContent({ base }: { base: BaseIntegrada }) {
  const [grao, setGrao] = React.useState<GraoSimulador>('soja')
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [dados, setDados] = React.useState<RespostaPanorama | null>(null)

  const carregar = React.useCallback(async (graoAlvo: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(
        `/api/intel/panorama?grao=${encodeURIComponent(graoAlvo)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        if (res.status === 403) setErro('Módulo não disponível no seu plano.')
        else if (res.status === 401)
          setErro('Sessão expirada. Faça login novamente.')
        else setErro('Não foi possível carregar o panorama. Tente novamente.')
        setDados(null)
        return
      }
      const json = (await res.json()) as RespostaPanorama
      setDados(json)
    } catch {
      setErro('Falha de conexão ao buscar o panorama. Tente novamente.')
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  React.useEffect(() => {
    void carregar(grao)
  }, [grao, carregar])

  const panorama = dados?.panorama ?? null
  const fontesOk = dados?.fontesOk ?? []
  const fontesFalha = dados?.fontesFalha ?? []
  const veredito = React.useMemo(() => calcularVeredito(panorama), [panorama])

  return (
    <div className="space-y-6">
      {/* Barra de controle. */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label="Grão"
              options={GRAOS}
              value={grao}
              onChange={(e) => setGrao(e.target.value as GraoSimulador)}
              containerClassName="w-40"
            />
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              loading={carregando}
              onClick={() => void carregar(grao)}
            >
              Atualizar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant="neutral">
              Atualizado em {formatarBrasilia(base.atualizadoEm)}
            </Chip>
            {base.fonteDados ? (
              <Chip variant="info">Preço · {base.fonteDados}</Chip>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Erro do panorama (preço segue funcionando). */}
      {erro ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Panorama indisponível"
            description={erro}
            cta={
              <Button
                variant="secondary"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => void carregar(grao)}
              >
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : null}

      {/* Veredito consolidado no topo. */}
      <CardVeredito veredito={veredito} carregando={carregando} />

      {/* Grid: preço + panorama lado a lado em telas largas. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SecaoPreco grao={grao} base={base} />
        <SecaoPanorama
          panorama={panorama}
          fontesOk={fontesOk}
          fontesFalha={fontesFalha}
          carregando={carregando}
        />
      </div>

      {/* Loading inicial. */}
      {!erro && carregando && !panorama ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Consolidando análise…"
            description="Cruzando o fair value de preço com o panorama das fontes USDA, BCB Focus e CONAB."
          />
        </Card>
      ) : null}
    </div>
  )
}
