'use client'

/**
 * app/intel/veredito/_components/VeredictoContent.tsx
 *
 * O painel do VEREDITO DE MERCADO — o produto vendável e HONESTO do BH
 * Intelligence. Consome GET /api/intel/veredito?grao=soja|milho e renderiza:
 *  - HERO: o VEREDITO CONSOLIDADO em destaque premium — a direção final do voto
 *    em número/recomendação grande (VENDER vermelho / SEGURAR verde / NEUTRO),
 *    com gradiente sutil por direção, a concordância como 3 pontos preenchidos
 *    (ex. 3/3), a confiança e o resumo. Se a janela sazonal está em pico
 *    (convicaoSazonal.altaConvicao), exibe um badge destacado.
 *  - "3 ÂNGULOS": um Card premium por sinal (Sazonal · Preço vs média ·
 *    Momentum), com ícone, a recomendação atual como chip colorido, o motivo, a
 *    TAXA HISTÓRICA real + ganho vs acaso e uma ProgressBar de acerto.
 *  - "TRANSPARÊNCIA": rodapé honesto em card glass discreto — não prometemos
 *    prever o futuro, apenas 3 métodos comprovados em 25 anos com vantagem real
 *    e auditável sobre o acaso. Mostra mesesAnalisados e o ganho consolidado.
 *
 * Posicionamento HONESTO: NUNCA exibe "75%" nem "garantido". O teto da direção
 * é ~55-60% e o edge é modesto (+5 a +6pp). Tudo best-effort: o endpoint sempre
 * responde 200; aqui tratamos loading, erro de rede e ausência de dado real
 * (erro 'sem_dados') sem quebrar a tela.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Chip,
  Select,
  ProgressBar,
  GrainBadge,
  EmptyState,
} from '@/components/ui/phb'
import type { GrainVariant } from '@/components/ui/phb'
import { BotaoAtualizar } from '@/app/intel/_components/BotaoAtualizar'
import {
  Gavel,
  TrendingDown,
  ShieldCheck,
  Minus,
  CalendarRange,
  Activity,
  LineChart,
  ScaleIcon,
  Star,
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

interface ConvicaoSazonal {
  altaConvicao: boolean
  taxaHistorica: number
  coberturaPct: number
  confianca: 'alta' | 'media' | 'baixa'
  nota: string
}

interface Veredito {
  sinais: ResultadoSinal[]
  direcao: DirecaoSinal
  concordancia: number
  confianca: 'alta' | 'media' | 'baixa'
  taxaHistorica: number
  ganhoVsAcaso: number
  resumo: string
  convicaoSazonal?: ConvicaoSazonal
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

// ── Sub-componente: pontos de concordância (ex. ●●○ = 2/3) ────────────────────

function PontosConcordancia({
  concordam,
  total,
  cor,
}: {
  concordam: number
  total: number
  cor: string
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${concordam} de ${total} ângulos concordam`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const ativo = i < concordam
        return (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full transition-colors"
            style={{
              background: ativo ? cor : 'transparent',
              boxShadow: ativo ? 'none' : `inset 0 0 0 1.5px var(--fg-3)`,
              opacity: ativo ? 1 : 0.5,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Sub-componente: HERO do veredito consolidado ─────────────────────────────

function VeredictoHero({ veredito }: { veredito: Veredito }) {
  const vis = visualDirecao(veredito.direcao)
  const total = veredito.sinais.length || 3
  const cs = veredito.convicaoSazonal

  return (
    <Card
      className="relative overflow-hidden p-0"
      style={{ borderColor: vis.cor }}
    >
      {/* Gradiente sutil por direção como fundo do hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${vis.cor} 14%, transparent) 0%, var(--accent-soft) 55%, transparent 100%)`,
          opacity: 0.6,
        }}
      />

      <div className="relative p-6 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Veredito consolidado · voto majoritário dos 3 ângulos</p>
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill"
            style={{ background: 'var(--glass)' }}
          >
            <Gavel className="h-4 w-4 text-fg-3" aria-hidden />
          </span>
        </div>

        {/* Badge de janela sazonal de pico (quando aplicável). */}
        {cs?.altaConvicao ? (
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-small font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--gold) 18%, transparent)',
                color: 'var(--gold)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--gold) 40%, transparent)',
              }}
            >
              <Star className="h-4 w-4 fill-current" aria-hidden />
              Janela sazonal de pico · {cs.taxaHistorica}% histórico
            </span>
          </div>
        ) : null}

        {/* Direção final em destaque grande + concordância visual. */}
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `color-mix(in srgb, ${vis.cor} 16%, var(--surface-2))`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${vis.cor} 35%, transparent)`,
              }}
            >
              <vis.Icone className="h-8 w-8" style={{ color: vis.cor }} aria-hidden />
            </span>
            <div>
              <p
                className="text-h1 font-semibold leading-none tracking-tight"
                style={{ color: vis.cor }}
              >
                {vis.rotulo}
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <PontosConcordancia
                  concordam={veredito.concordancia}
                  total={total}
                  cor={vis.cor}
                />
                <span className="text-small text-fg-2">
                  {veredito.concordancia} de {total} ângulos concordam
                </span>
              </div>
            </div>
          </div>

          {/* Métricas-chave do veredito em chips. */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant={CONFIANCA_VARIANT[veredito.confianca]}>
              {CONFIANCA_LABEL[veredito.confianca]}
            </Chip>
            <Chip variant="info">
              {veredito.taxaHistorica}% histórico
            </Chip>
            <Chip variant="neutral">{formatarGanho(veredito.ganhoVsAcaso)}</Chip>
          </div>
        </div>

        {/* Resumo de copiloto, honesto. */}
        <p className="text-body text-fg-2 leading-relaxed mt-6">{veredito.resumo}</p>

        {/* Nota sazonal honesta, quando há janela de alta convicção. */}
        {cs?.altaConvicao && cs.nota ? (
          <p className="text-small text-fg-3 leading-snug mt-3">{cs.nota}</p>
        ) : null}
      </div>
    </Card>
  )
}

// ── Sub-componente: Card de um dos 3 ângulos ─────────────────────────────────

function CardAngulo({ sinal }: { sinal: ResultadoSinal }) {
  const meta = META_SINAL[sinal.nome]
  const vis = visualDirecao(sinal.direcao)
  const taxa = sinal.taxaHistorica
  const acaso = sinal.direcao === 'neutro'
  const corBarra = acaso ? 'var(--fg-3)' : vis.cor

  return (
    <Card className="relative overflow-hidden">
      {/* Fio de cor no topo identificando a direção do ângulo. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: corBarra }}
      />
      <CardHeader>
        <CardTitle eyebrow={`${meta.ordem}. ${meta.angulo}`}>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${corBarra} 14%, var(--surface-2))` }}
            >
              <meta.Icone className="h-4 w-4" style={{ color: corBarra }} aria-hidden />
            </span>
            <span>{meta.titulo}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Recomendação atual em destaque (chip colorido). */}
        <div
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-small font-semibold"
          style={{
            color: vis.cor,
            background: `color-mix(in srgb, ${vis.cor} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${vis.cor} 30%, transparent)`,
          }}
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
          <ProgressBar value={taxa} color={corBarra} showValue={false} size="sm" />
          <p className="text-small text-fg-3">
            Acertou a direção em {taxa}% das vezes (referência: 25 anos · 262 meses).
          </p>
        </div>
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
    <Card style={{ background: 'var(--glass)', backdropFilter: 'var(--blur-card)' }}>
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
  const router = useRouter()
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

  // Após o BotaoAtualizar forçar o refresh server-side, recarrega o veredito.
  const aposAtualizar = React.useCallback(() => {
    router.refresh()
    void carregar(grao)
  }, [router, carregar, grao])

  const veredito = dados?.veredito ?? null
  const semDado = dados?.erro === 'sem_dados'
  const grainVariant = (grao === 'milho' ? 'milho' : 'soja') as GrainVariant

  // Sinais ordenados pela ordem de apresentação (sazonal · mr · momentum).
  const sinaisOrdenados = React.useMemo(() => {
    if (!veredito) return []
    return [...veredito.sinais].sort(
      (a, b) => META_SINAL[a.nome].ordem - META_SINAL[b.nome].ordem,
    )
  }, [veredito])

  return (
    <div className="space-y-6">
      {/* Header: título + botão atualizar agora + barra de controle. */}
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
            <div className="flex items-center gap-2 pb-1">
              <GrainBadge variant={grainVariant} />
              {dados && !semDado ? (
                <Chip variant="neutral">Atualizado em {formatarBrasilia(dados.geradoEm)}</Chip>
              ) : null}
            </div>
          </div>

          <div className="pb-0.5">
            <BotaoAtualizar onAtualizado={aposAtualizar} />
          </div>
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
          {/* SEÇÃO 1 — HERO: veredito consolidado em destaque premium. */}
          <VeredictoHero veredito={veredito} />

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
