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

      <div className="relative p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Veredito consolidado · voto majoritário dos 3 ângulos</p>
          {cs?.altaConvicao ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-small font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--gold) 18%, transparent)',
                color: 'var(--gold)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--gold) 40%, transparent)',
              }}
            >
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              Pico sazonal · {cs.taxaHistorica}%
            </span>
          ) : (
            <Gavel className="h-4 w-4 text-fg-3" aria-hidden />
          )}
        </div>

        {/* Direção final em destaque + concordância + métricas (uma linha). */}
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `color-mix(in srgb, ${vis.cor} 16%, var(--surface-2))`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${vis.cor} 35%, transparent)`,
              }}
            >
              <vis.Icone className="h-6 w-6" style={{ color: vis.cor }} aria-hidden />
            </span>
            <div>
              <p
                className="text-h2 font-semibold leading-none tracking-tight"
                style={{ color: vis.cor }}
              >
                {vis.rotulo}
              </p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <PontosConcordancia
                  concordam={veredito.concordancia}
                  total={total}
                  cor={vis.cor}
                />
                <span className="text-small text-fg-2">
                  {veredito.concordancia} de {total} concordam
                </span>
              </div>
            </div>
          </div>

          {/* Métricas-chave do veredito em chips. */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant={CONFIANCA_VARIANT[veredito.confianca]}>
              {CONFIANCA_LABEL[veredito.confianca]}
            </Chip>
            <Chip variant="info">{veredito.taxaHistorica}% histórico</Chip>
            <Chip variant="neutral">{formatarGanho(veredito.ganhoVsAcaso)}</Chip>
          </div>
        </div>

        {/* Resumo de copiloto, honesto (compacto). */}
        <p className="text-small text-fg-2 leading-snug mt-3">{veredito.resumo}</p>
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
      <CardBody className="space-y-2.5">
        {/* Recomendação atual em destaque (chip colorido). */}
        <div
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1 text-small font-semibold"
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
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-h2 text-fg-1 t-num">{taxa}%</span>
            <span className="text-small text-fg-3">{formatarGanho(sinal.ganhoVsAcaso)}</span>
          </div>
          <ProgressBar value={taxa} color={corBarra} showValue={false} size="sm" />
          <p className="text-micro text-fg-3">acerto histórico · 25 anos / 262 meses</p>
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
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-2.5"
      style={{ background: 'var(--glass)', backdropFilter: 'var(--blur-card)' }}
    >
      <span className="inline-flex items-center gap-1.5 text-small text-fg-2">
        <ScaleIcon className="h-3.5 w-3.5 text-fg-3 shrink-0" aria-hidden />
        Não é bola de cristal: 3 métodos auditáveis, comprovados em {mesesAnalisados} meses.
      </span>
      <Chip variant="info">Ganho {formatarGanho(ganhoConsolidado)} vs acaso</Chip>
      <span className="text-micro text-fg-3">Teto comprovado ~55-60% · recalculado ao vivo</span>
    </div>
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
    <div className="space-y-3">
      {/* Barra de controle compacta: grão + atualizado + botão (uma linha). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label="Grão"
            options={GRAOS}
            value={grao}
            onChange={(e) => setGrao(e.target.value)}
            containerClassName="w-36"
          />
          <div className="flex items-center gap-2 pt-4">
            <GrainBadge variant={grainVariant} />
            {dados && !semDado ? (
              <Chip variant="neutral">Atualizado em {formatarBrasilia(dados.geradoEm)}</Chip>
            ) : null}
          </div>
        </div>
        <div className="pt-4">
          <BotaoAtualizar onAtualizado={aposAtualizar} />
        </div>
      </div>

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
            <p className="eyebrow mb-2">3 ângulos independentes</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
