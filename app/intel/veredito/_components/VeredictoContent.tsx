'use client'

/**
 * app/intel/veredito/_components/VeredictoContent.tsx
 *
 * O painel do VEREDITO DE MERCADO — o produto vendável e HONESTO do BH
 * Intelligence. Consome GET /api/intel/veredito?grao=soja|milho e renderiza:
 *  - "3 ÂNGULOS": um Card por sinal (Sazonal · Preço vs média · Momentum), com
 *    a recomendação atual (VENDER vermelho / SEGURAR verde / NEUTRO cinza), o
 *    motivo em 1 linha, a TAXA HISTÓRICA real + ganho vs acaso e uma barra.
 *  - "VEREDITO CONSOLIDADO": a direção final do voto, a concordância (ex.
 *    "2 de 3 ângulos concordam"), a confiança e o resumo, com cor pela direção.
 *  - "TRANSPARÊNCIA": rodapé honesto — não prometemos prever o futuro, apenas
 *    3 métodos comprovados em 25 anos com vantagem real e auditável sobre o
 *    acaso. Mostra mesesAnalisados e o ganho consolidado vs 50%.
 *
 * Posicionamento HONESTO: NUNCA exibe "75%" nem "garantido". O teto da direção
 * é ~55-60% e o edge é modesto (+5 a +6pp). Tudo best-effort: o endpoint sempre
 * responde 200; aqui tratamos loading, erro de rede e ausência de dado real
 * (erro 'sem_dados') sem quebrar a tela.
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
  ProgressBar,
  EmptyState,
} from '@/components/ui/phb'
import {
  Gavel,
  RefreshCw,
  TrendingDown,
  ShieldCheck,
  Minus,
  CalendarRange,
  Activity,
  LineChart,
  ScaleIcon,
} from 'lucide-react'

// ── Tipos da resposta da API (espelham lib/veredito/sinais.ts) ───────────────

type DirecaoSinal = 'vender' | 'segurar' | 'neutro'

interface ResultadoSinal {
  nome: 'sazonal' | 'mean_reversion' | 'momentum'
  direcao: DirecaoSinal
  motivo: string
  taxaHistorica: number
  ganhoVsAcaso: number
}

interface Veredito {
  sinais: ResultadoSinal[]
  direcao: DirecaoSinal
  concordancia: number
  confianca: 'alta' | 'media' | 'baixa'
  taxaHistorica: number
  ganhoVsAcaso: number
  resumo: string
}

interface RespostaVeredito {
  grao: 'soja' | 'milho'
  veredito?: Veredito
  mesesAnalisados: number
  geradoEm: string
  fontesOk?: string[]
  erro?: 'sem_dados'
}

// ── Opções e rótulos ─────────────────────────────────────────────────────────

const GRAOS: { value: string; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
]

/** Metadados de apresentação por sinal — título amigável, ângulo e ícone. */
const META_SINAL: Record<
  ResultadoSinal['nome'],
  { ordem: number; titulo: string; angulo: string; Icone: typeof Activity }
> = {
  sazonal: {
    ordem: 1,
    titulo: 'Sazonal',
    angulo: 'Padrão do mês calendário',
    Icone: CalendarRange,
  },
  mean_reversion: {
    ordem: 2,
    titulo: 'Preço vs média',
    angulo: 'Desvio da média móvel 12m',
    Icone: LineChart,
  },
  momentum: {
    ordem: 3,
    titulo: 'Tendência / Momentum',
    angulo: 'Variação do CBOT em 6m',
    Icone: Activity,
  },
}

// ── Helpers de direção (cor, rótulo, ícone) ──────────────────────────────────

interface VisualDirecao {
  rotulo: string
  cor: string
  variant: 'pos' | 'neg' | 'neutral'
  Icone: typeof TrendingDown
}

function visualDirecao(direcao: DirecaoSinal): VisualDirecao {
  if (direcao === 'vender') {
    return {
      rotulo: 'VENDER',
      cor: 'var(--danger)',
      variant: 'neg',
      Icone: TrendingDown,
    }
  }
  if (direcao === 'segurar') {
    return {
      rotulo: 'SEGURAR',
      cor: 'var(--success)',
      variant: 'pos',
      Icone: ShieldCheck,
    }
  }
  return {
    rotulo: 'NEUTRO',
    cor: 'var(--fg-3)',
    variant: 'neutral',
    Icone: Minus,
  }
}

/** Formata o ganho vs acaso com sinal explícito em pontos percentuais. */
function formatarGanho(ganho: number): string {
  const sinal = ganho > 0 ? '+' : ''
  return `${sinal}${ganho.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}pp vs acaso`
}

/** Formata a data ISO no fuso de Brasília: DD/MM HH:mm. */
function formatarBrasilia(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return '—'
  }
}

const CONFIANCA_LABEL: Record<Veredito['confianca'], string> = {
  alta: 'Confiança alta',
  media: 'Confiança média',
  baixa: 'Confiança baixa',
}

const CONFIANCA_VARIANT: Record<Veredito['confianca'], 'pos' | 'warn' | 'neutral'> = {
  alta: 'pos',
  media: 'warn',
  baixa: 'neutral',
}

// ── Sub-componente: Card de um dos 3 ângulos ─────────────────────────────────

function CardAngulo({ sinal }: { sinal: ResultadoSinal }) {
  const meta = META_SINAL[sinal.nome]
  const vis = visualDirecao(sinal.direcao)
  const taxa = sinal.taxaHistorica
  const acaso = sinal.direcao === 'neutro'

  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow={`${meta.ordem}. ${meta.angulo}`}>
          <span className="inline-flex items-center gap-2">
            <meta.Icone className="h-4 w-4 text-fg-3" aria-hidden />
            <span>{meta.titulo}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Recomendação atual em destaque. */}
        <div
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-small font-semibold"
          style={{ color: vis.cor, background: 'var(--bg-3)' }}
        >
          <vis.Icone className="h-4 w-4" aria-hidden />
          {vis.rotulo}
        </div>

        {/* Motivo em 1 linha. */}
        <p className="text-small text-fg-2 leading-snug">{sinal.motivo}</p>

        {/* Taxa histórica real + ganho vs acaso + barra de acerto. */}
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-h2 text-fg-1 t-num">{taxa}%</span>
            <span className="text-small text-fg-3">{formatarGanho(sinal.ganhoVsAcaso)}</span>
          </div>
          <ProgressBar
            value={taxa}
            color={acaso ? 'var(--fg-3)' : vis.cor}
            showValue={false}
            size="sm"
          />
          <p className="text-small text-fg-3">
            Acertou a direção em {taxa}% das vezes (referência: 25 anos · 262 meses).
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Sub-componente: Veredito consolidado ─────────────────────────────────────

function VeredictoConsolidado({ veredito }: { veredito: Veredito }) {
  const vis = visualDirecao(veredito.direcao)
  const total = veredito.sinais.length || 3

  return (
    <Card
      style={{
        borderColor: vis.cor,
        boxShadow: `inset 0 0 0 1px ${vis.cor}`,
      }}
    >
      <CardHeader>
        <CardTitle eyebrow="Veredito consolidado · voto majoritário dos 3 ângulos">
          <span className="inline-flex items-center gap-2">
            <Gavel className="h-4 w-4 text-fg-3" aria-hidden />
            <span>Decisão sugerida</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          {/* Direção final em destaque grande. */}
          <div className="flex items-center gap-3">
            <vis.Icone className="h-9 w-9 shrink-0" style={{ color: vis.cor }} aria-hidden />
            <div>
              <p className="text-h1 font-semibold leading-none" style={{ color: vis.cor }}>
                {vis.rotulo}
              </p>
              <p className="text-small text-fg-3 mt-1">
                {veredito.concordancia} de {total} ângulos concordam
              </p>
            </div>
          </div>

          {/* Chips de confiança / concordância / taxa do veredito. */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant={CONFIANCA_VARIANT[veredito.confianca]}>
              {CONFIANCA_LABEL[veredito.confianca]}
            </Chip>
            <Chip variant="neutral">
              {veredito.concordancia}/{total} concordância
            </Chip>
            <Chip variant="info">
              {veredito.taxaHistorica}% histórico · {formatarGanho(veredito.ganhoVsAcaso)}
            </Chip>
          </div>
        </div>

        {/* Resumo de copiloto, honesto. */}
        <p className="text-body text-fg-2 leading-relaxed mt-5">{veredito.resumo}</p>
      </CardBody>
    </Card>
  )
}

// ── Sub-componente: Transparência (honestidade que vende) ────────────────────

function Transparencia({
  mesesAnalisados,
  ganhoConsolidado,
}: {
  mesesAnalisados: number
  ganhoConsolidado: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Transparência · por que confiar">
          <span className="inline-flex items-center gap-2">
            <ScaleIcon className="h-4 w-4 text-fg-3" aria-hidden />
            <span>Honestidade que orienta a decisão</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-body text-fg-2 leading-relaxed">
          Não prometemos prever o futuro. Mostramos 3 métodos independentes,
          comprovados em 25 anos ({mesesAnalisados} meses analisados), cada um com
          vantagem real e auditável sobre o acaso. Você decide melhor informado —
          não com uma bola de cristal, mas com 3 ângulos que se reforçam.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="neutral">{mesesAnalisados} meses analisados</Chip>
          <Chip variant="info">Ganho consolidado {formatarGanho(ganhoConsolidado)}</Chip>
          <Chip variant="neutral">Baseline do acaso = 50%</Chip>
        </div>
        <p className="text-small text-fg-3 leading-snug">
          O teto comprovado da direção é ~55-60%: o edge é modesto, porém
          consistente. Cada número acima é recalculado ao vivo sobre a própria
          série histórica de preço — sem promessas infladas.
        </p>
      </CardBody>
    </Card>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VeredictoContent() {
  const [grao, setGrao] = React.useState<string>('soja')
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [dados, setDados] = React.useState<RespostaVeredito | null>(null)

  const carregar = React.useCallback(async (graoAlvo: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(
        `/api/intel/veredito?grao=${encodeURIComponent(graoAlvo)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        if (res.status === 403) {
          setErro('Módulo não disponível no seu plano.')
        } else if (res.status === 401) {
          setErro('Sessão expirada. Faça login novamente.')
        } else {
          setErro('Não foi possível carregar o veredito. Tente novamente.')
        }
        setDados(null)
        return
      }
      const json = (await res.json()) as RespostaVeredito
      setDados(json)
    } catch {
      setErro('Falha de conexão ao buscar o veredito. Tente novamente.')
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carrega ao montar e sempre que o grão muda.
  React.useEffect(() => {
    void carregar(grao)
  }, [grao, carregar])

  const veredito = dados?.veredito ?? null
  const semDado = dados?.erro === 'sem_dados'

  // Sinais ordenados pela ordem de apresentação (sazonal · mr · momentum).
  const sinaisOrdenados = React.useMemo(() => {
    if (!veredito) return []
    return [...veredito.sinais].sort(
      (a, b) => META_SINAL[a.nome].ordem - META_SINAL[b.nome].ordem,
    )
  }, [veredito])

  return (
    <div className="space-y-6">
      {/* Barra de controle: seletor de grão, atualizar e status. */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label="Grão"
              options={GRAOS}
              value={grao}
              onChange={(e) => setGrao(e.target.value)}
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

          {dados && !semDado ? (
            <Chip variant="neutral">Atualizado em {formatarBrasilia(dados.geradoEm)}</Chip>
          ) : null}
        </div>
      </Card>

      {/* Estado de erro de rede/plano. */}
      {erro ? (
        <EmptyState
          icon={Gavel}
          title="Não foi possível carregar"
          description={erro}
        />
      ) : null}

      {/* Sem dado real (gabarito não carregou) — honesto, não inventa veredito. */}
      {!erro && semDado ? (
        <EmptyState
          icon={Gavel}
          title="Sem dados suficientes para um veredito honesto"
          description="A série de preço físico (gabarito) não está disponível neste momento. Não inventamos um veredito sem dado real — tente atualizar em instantes."
        />
      ) : null}

      {/* Conteúdo principal. */}
      {!erro && !semDado && veredito ? (
        <>
          {/* SEÇÃO 1 — Veredito consolidado em destaque. */}
          <VeredictoConsolidado veredito={veredito} />

          {/* SEÇÃO 2 — Os 3 ângulos lado a lado. */}
          <div>
            <p className="eyebrow mb-3">3 ângulos independentes</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sinaisOrdenados.map((s) => (
                <CardAngulo key={s.nome} sinal={s} />
              ))}
            </div>
          </div>

          {/* SEÇÃO 3 — Transparência (honestidade que vende). */}
          <Transparencia
            mesesAnalisados={dados?.mesesAnalisados ?? 0}
            ganhoConsolidado={veredito.ganhoVsAcaso}
          />
        </>
      ) : null}

      {/* Loading inicial (sem dado ainda). */}
      {!erro && !semDado && !veredito && carregando ? (
        <EmptyState icon={Gavel} title="Carregando veredito…" description="Cruzando os 3 ângulos sobre 25 anos de histórico." />
      ) : null}
    </div>
  )
}
