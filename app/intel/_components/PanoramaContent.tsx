'use client'

/**
 * app/intel/_components/PanoramaContent.tsx
 *
 * Painel de PANORAMA da Inteligência de Mercado. Consome o endpoint
 * GET /api/intel/panorama?grao=soja|milho e renderiza:
 *  - Bloco de SINAIS no topo (chips de viés altista/baixista/neutro).
 *  - Um Card por fonte (USDA PSD, USDA ESR, BCB Focus, CONAB, Câmbio), cada
 *    item com rótulo + valor + seta colorida (▲ verde / ▼ vermelho / – neutro).
 *  - Curva de dólar futuro (quando presente) como mini-tabela mês × mediana.
 *  - Chip "Atualizado em DD/MM/AAAA HH:mm" (Brasília) + contador fontesOk/Falha.
 *
 * Tudo best-effort: o endpoint sempre responde 200; aqui tratamos loading,
 * erro de rede e ausência de dados sem quebrar a tela.
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
  EmptyState,
} from '@/components/ui/phb'
import {
  Radar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import type {
  PanoramaIntel,
  PanoramaFonte,
  PanoramaItem,
  PanoramaSinal,
  Seta,
  Vies,
  Grao,
} from '@/lib/intel/agregador'

// ── Tipos da resposta da API ────────────────────────────────────────────────

interface RespostaPanorama {
  grao: Grao
  panorama: PanoramaIntel
  fontesOk: string[]
  fontesFalha: string[]
  geradoEm: string
}

// ── Opções ──────────────────────────────────────────────────────────────────

const GRAOS: { value: string; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
]

// Ícone/emoji por fonte (casado com `fonte` no agregador).
const ICONE_FONTE: Record<string, string> = {
  'USDA PSD': '📄',
  'USDA ESR': '🚢',
  'BCB Focus': '📋',
  CONAB: '🌾',
  Câmbio: '💵',
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

/** Formata a data ISO no fuso de Brasília: DD/MM/AAAA HH:mm. */
function formatarBrasilia(iso: string): string {
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

/** Formata a variação percentual com sinal explícito. */
function formatarVariacao(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Seta colorida (▲ verde / ▼ vermelho / – neutro) + variação textual. */
function SetaVariacao({
  seta,
  variacao,
}: {
  seta?: Seta
  variacao?: number | null
}) {
  const txt = formatarVariacao(variacao)
  if (!seta || seta === 'flat') {
    if (txt === null) return null
    return (
      <span className="inline-flex items-center gap-1 text-small text-fg-3">
        <Minus className="h-3.5 w-3.5" />
        {txt}
      </span>
    )
  }
  const up = seta === 'up'
  const cor = up ? 'var(--success)' : 'var(--danger)'
  const Icone = up ? TrendingUp : TrendingDown
  return (
    <span
      className="inline-flex items-center gap-1 text-small"
      style={{ color: cor }}
    >
      <Icone className="h-3.5 w-3.5" />
      {txt}
    </span>
  )
}

/** Uma linha de item (rótulo · valor + seta) dentro de um Card de fonte. */
function ItemLinha({ item }: { item: PanoramaItem }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border-1 last:border-b-0">
      <div className="min-w-0">
        <p className="text-small text-fg-2 truncate">{item.rotulo}</p>
        {item.nota ? <p className="text-small text-fg-3">{item.nota}</p> : null}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-body font-medium text-fg-1 tabular-nums">
          {item.valor}
        </span>
        <SetaVariacao seta={item.seta} variacao={item.variacao} />
      </div>
    </div>
  )
}

/** Card de uma fonte do panorama. */
function CardFonte({ fonte }: { fonte: PanoramaFonte }) {
  const emoji = ICONE_FONTE[fonte.fonte] ?? '📊'
  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow={fonte.fonte}>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>{emoji}</span>
            <span>{fonte.titulo}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {fonte.itens.length === 0 ? (
          <p className="text-small text-fg-3 py-2">Sem dados disponíveis.</p>
        ) : (
          fonte.itens.map((item, i) => <ItemLinha key={i} item={item} />)
        )}
      </CardBody>
    </Card>
  )
}

/** Mapeia viés → variante de Chip. */
function chipVarianteVies(vies: Vies): 'pos' | 'neg' | 'neutral' {
  if (vies === 'altista') return 'pos'
  if (vies === 'baixista') return 'neg'
  return 'neutral'
}

/** Bloco de sinais (chips de viés) no topo. */
function BlocoSinais({ sinais }: { sinais: PanoramaSinal[] }) {
  if (sinais.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle eyebrow="Leitura de mercado">Sinais</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-small text-fg-3">
            Sem variações relevantes nas fontes para gerar sinais nesta leitura.
          </p>
        </CardBody>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Leitura de mercado">Sinais</CardTitle>
      </CardHeader>
      <CardBody>
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
              </Chip>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function PanoramaContent() {
  const [grao, setGrao] = React.useState<string>('soja')
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
        if (res.status === 403) {
          setErro('Módulo não disponível no seu plano.')
        } else if (res.status === 401) {
          setErro('Sessão expirada. Faça login novamente.')
        } else {
          setErro('Não foi possível carregar o panorama. Tente novamente.')
        }
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

  // Carrega ao montar e sempre que o grão muda.
  React.useEffect(() => {
    void carregar(grao)
  }, [grao, carregar])

  const panorama = dados?.panorama ?? null
  const fontesOk = dados?.fontesOk ?? []
  const fontesFalha = dados?.fontesFalha ?? []

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

          <div className="flex flex-wrap items-center gap-2">
            {dados ? (
              <Chip variant="neutral">
                Atualizado em {formatarBrasilia(dados.geradoEm)}
              </Chip>
            ) : null}
            {fontesOk.length > 0 ? (
              <Chip
                variant="pos"
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                {fontesOk.length}{' '}
                {fontesOk.length === 1 ? 'fonte ok' : 'fontes ok'}
              </Chip>
            ) : null}
            {fontesFalha.length > 0 ? (
              <Chip
                variant="warn"
                leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}
              >
                {fontesFalha.length}{' '}
                {fontesFalha.length === 1 ? 'indisponível' : 'indisponíveis'}
              </Chip>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Erro de carregamento. */}
      {erro ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar"
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

      {/* Loading inicial (sem dados ainda). */}
      {!erro && carregando && !panorama ? (
        <Card>
          <EmptyState
            icon={Radar}
            title="Carregando panorama…"
            description="Consultando USDA, BCB Focus e CONAB. Isso pode levar alguns segundos."
          />
        </Card>
      ) : null}

      {/* Panorama carregado. */}
      {!erro && panorama ? (
        <>
          <BlocoSinais sinais={panorama.sinais} />

          {panorama.fontes.length === 0 ? (
            <Card>
              <EmptyState
                icon={Radar}
                title="Nenhuma fonte disponível agora"
                description="As fontes externas não responderam nesta leitura. Tente atualizar em instantes."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {panorama.fontes.map((fonte, i) => (
                <CardFonte key={`${fonte.fonte}-${i}`} fonte={fonte} />
              ))}
            </div>
          )}

          {/* Lista de fontes indisponíveis (transparência). */}
          {fontesFalha.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle eyebrow="Diagnóstico">
                  Fontes indisponíveis nesta leitura
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {fontesFalha.map((f, i) => (
                    <Chip
                      key={i}
                      variant="warn"
                      leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}
                    >
                      {f}
                    </Chip>
                  ))}
                </div>
                <p className="text-small text-fg-3 mt-2">
                  Estas fontes não responderam a tempo. Os demais dados seguem
                  válidos. Tente atualizar para recompor o panorama.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
