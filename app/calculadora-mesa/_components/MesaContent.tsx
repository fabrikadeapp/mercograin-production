'use client'

import * as React from 'react'
import {
  Calculator,
  RefreshCw,
  Clock,
  Trophy,
  ArrowRightLeft,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Chip,
  GrainBadge,
  Button,
  KPICard,
} from '@/components/ui/phb'
import {
  compararTradings,
  resumoMercado,
  type VisaoIntegrada,
  type TradingComparavel,
} from '@/lib/cotacoes/integrada'
import type { GraoSimulador } from '@/lib/cotacoes/simulador'

type GraoLabel = 'soja' | 'milho' | 'trigo'

/** Dados base pré-carregados no servidor (cotações ao vivo / do banco). */
export interface BaseInicial {
  cbot: Record<GraoLabel, number | null>
  cambio: number | null
  /** Timestamp ISO da última atualização dos dados. */
  atualizadoEm: string | null
  /** Fonte (ex.: CEPEA, Yahoo/Investing ao vivo). */
  fonte: string | null
}

interface Props {
  base: BaseInicial
}

/** Linha editável da mesa: o operador informa OU prêmio OU preço de balcão. */
interface LinhaMesa {
  nome: string
  /** Prêmio divulgado pela trading (¢/bu). String vazia = não informado. */
  premio: string
  /** Preço de balcão pago pela trading (R$/sc60). String vazia = não informado. */
  precoBalcao: string
}

const GRAOS: { value: GraoSimulador; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
]

/** Tradings padrão da mesa de originação (espelha a planilha PREMIOS). */
const TRADINGS_DEFAULT: string[] = [
  'COFCO',
  'AMAGGI',
  'LDC',
  'ADM',
  'BUNGE',
  'OLAM',
  'CHS',
  'BTG',
  'CARGILL',
]

function linhasIniciais(): LinhaMesa[] {
  return TRADINGS_DEFAULT.map((nome) => ({ nome, premio: '', precoBalcao: '' }))
}

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtUsdBu(n: number): string {
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/bu`
}
function fmtCentsBu(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ¢/bu`
}

/** Converte string de input numérico em number finito ou null. */
function parseNum(v: string): number | null {
  if (v.trim() === '') return null
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function MesaContent({ base }: Props) {
  // ── Parâmetros base ──────────────────────────────────────────────────────
  const [grao, setGrao] = React.useState<GraoSimulador>('soja')
  const [cbot, setCbot] = React.useState<number>(() => base.cbot.soja ?? 0)
  const [cambio, setCambio] = React.useState<number>(() => base.cambio ?? 0)
  const [fobbings, setFobbings] = React.useState<number>(-12)
  const [frete, setFrete] = React.useState<number>(3)

  // ── Tabela mestre de tradings ────────────────────────────────────────────
  const [linhas, setLinhas] = React.useState<LinhaMesa[]>(() => linhasIniciais())

  // ── Estado da atualização ao vivo ────────────────────────────────────────
  const [atualizando, setAtualizando] = React.useState(false)
  const [erroAtualizar, setErroAtualizar] = React.useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = React.useState<string | null>(base.atualizadoEm)
  const [fonte, setFonte] = React.useState<string | null>(base.fonte)
  // Cache local das cotações ao vivo por grão, para trocar de grão sem refetch.
  const [cbotPorGrao, setCbotPorGrao] = React.useState<Record<GraoLabel, number | null>>(
    () => base.cbot,
  )

  // Ao trocar de grão, recarrega o CBOT daquele grão (se disponível).
  function trocarGrao(g: GraoSimulador) {
    setGrao(g)
    const c = cbotPorGrao[g]
    if (c != null) setCbot(c)
  }

  // Botão "Atualizar agora": busca CBOT + câmbio ao vivo via /api/cotacoes/forcar.
  async function atualizarAgora() {
    setAtualizando(true)
    setErroAtualizar(null)
    try {
      const res = await fetch('/api/cotacoes/forcar', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as {
        cbot?: Record<GraoLabel, number | null>
        cambio?: number | null
        atualizadoEm?: string
        erro?: string
      }
      if (j.cbot) {
        setCbotPorGrao(j.cbot)
        const c = j.cbot[grao]
        if (c != null) setCbot(c)
      }
      if (j.cambio != null) setCambio(j.cambio)
      setAtualizadoEm(j.atualizadoEm ?? new Date().toISOString())
      setFonte('Yahoo Finance + Investing.com (ao vivo)')
      if (j.erro) setErroAtualizar(j.erro)
    } catch (e: any) {
      setErroAtualizar(e?.message || 'Falha ao atualizar cotações')
    } finally {
      setAtualizando(false)
    }
  }

  // ── Cálculo integrado (memoizado) ────────────────────────────────────────
  const visao: VisaoIntegrada = {
    grao,
    cbotCentavosBu: cbot,
    cambioUsdBrl: cambio,
    fobbingsUsdTon: fobbings,
    freteBrlSc: frete,
  }

  const tradingsComparaveis: TradingComparavel[] = React.useMemo(
    () =>
      linhas.map((l) => {
        const premio = parseNum(l.premio)
        const preco = parseNum(l.precoBalcao)
        const t: TradingComparavel = { nome: l.nome }
        if (premio != null) t.premioCentavosBu = premio
        if (preco != null) t.precoBalcaoBrlSc = preco
        return t
      }),
    [linhas],
  )

  const comparadas = React.useMemo(
    () => compararTradings(visao, tradingsComparaveis),
    [grao, cbot, cambio, fobbings, frete, tradingsComparaveis],
  )

  const resumo = React.useMemo(
    () => resumoMercado(visao, tradingsComparaveis),
    [grao, cbot, cambio, fobbings, frete, tradingsComparaveis],
  )

  // Mapa nome→preço-informado para destaque consistente entre tabela e KPIs.
  const melhorPrecoNome = resumo.melhorTrading?.nome ?? null
  const melhorSpreadNome = resumo.melhorSpreadTrading?.nome ?? null
  // Melhor prêmio implícito (maior US$/bu embutido no preço de balcão).
  const melhorPremio = React.useMemo(() => {
    let best: { nome: string; valor: number } | null = null
    for (const l of comparadas) {
      if (l.premioImplicitoUsdBu == null) continue
      if (best == null || l.premioImplicitoUsdBu > best.valor) {
        best = { nome: l.nome, valor: l.premioImplicitoUsdBu }
      }
    }
    return best
  }, [comparadas])

  const temAlgumDado = tradingsComparaveis.some(
    (t) => t.premioCentavosBu != null || t.precoBalcaoBrlSc != null,
  )

  const atualizadoLabel = atualizadoEm
    ? new Date(atualizadoEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : null

  return (
    <div className="space-y-4">
      {/* ── KPIs do topo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          eyebrow="Melhor preço de balcão"
          value={resumo.melhorPrecoBrlSc != null ? fmtBRL(resumo.melhorPrecoBrlSc) : '—'}
          subtitle={melhorPrecoNome ? `${melhorPrecoNome} · R$/sc 60kg` : 'Informe prêmios ou preços'}
          highlightValue
        />
        <KPICard
          eyebrow="Melhor prêmio implícito"
          value={melhorPremio ? fmtUsdBu(melhorPremio.valor) : '—'}
          subtitle={melhorPremio ? `${melhorPremio.nome} · embutido no preço` : 'Informe preço de balcão'}
        />
        <KPICard
          eyebrow="Melhor spread"
          value={resumo.melhorSpread != null ? fmtUsdBu(resumo.melhorSpread) : '—'}
          subtitle={
            melhorSpreadNome ? `${melhorSpreadNome} · implícito − informado` : 'Preencha as duas pontas'
          }
          delta={
            resumo.melhorSpread != null
              ? {
                  value: resumo.melhorSpread >= 0 ? 'paga mais que diz' : 'paga menos que diz',
                  trend: resumo.melhorSpread >= 0 ? 'pos' : 'neg',
                }
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* ── Painel de parâmetros base ──────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Mercado">
                <span className="inline-flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Parâmetros base
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div>
                <label className="eyebrow mb-2 block">Grão</label>
                <div className="flex flex-wrap gap-2">
                  {GRAOS.map((g) => {
                    const ativo = grao === g.value
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => trocarGrao(g.value)}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-pill"
                      >
                        <GrainBadge
                          variant={g.value}
                          label={g.label}
                          className={ativo ? 'ring-2 ring-accent' : 'opacity-70'}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="CBOT (futuro Chicago)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={cbot || ''}
                  onChange={(e) => setCbot(parseFloat(e.target.value) || 0)}
                  rightAddon="¢/bu"
                  placeholder="1120"
                  helperText="Centavos de dólar por bushel"
                />
                <Input
                  label="Câmbio USD/BRL"
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  value={cambio || ''}
                  onChange={(e) => setCambio(parseFloat(e.target.value) || 0)}
                  rightAddon="R$"
                  placeholder="5,40"
                  helperText="Dólar do momento"
                />
                <Input
                  label="FOBBINGS"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={fobbings || ''}
                  onChange={(e) => setFobbings(parseFloat(e.target.value) || 0)}
                  rightAddon="US$/t"
                  placeholder="-12"
                  helperText="Custo de embarque (negativo)"
                />
                <Input
                  label="Frete até o porto"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={frete || ''}
                  onChange={(e) => setFrete(parseFloat(e.target.value) || 0)}
                  rightAddon="R$/sc"
                  placeholder="3,00"
                  helperText="Frete rodoviário por saca"
                />
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<RefreshCw className={`h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />}
                  onClick={atualizarAgora}
                  loading={atualizando}
                  className="w-full"
                >
                  {atualizando ? 'Atualizando…' : 'Atualizar agora'}
                </Button>
                {erroAtualizar ? (
                  <p className="text-small text-danger">{erroAtualizar}</p>
                ) : null}
                {atualizadoLabel ? (
                  <Chip variant="info" leftIcon={<Clock className="h-3 w-3" />}>
                    Dados atualizados em {atualizadoLabel}
                  </Chip>
                ) : (
                  <Chip variant="neutral">Cotação automática indisponível — insira manualmente</Chip>
                )}
                {fonte ? <p className="text-small text-fg-3">Fonte: {fonte}</p> : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Tabela mestre integrada ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Mesa unificada">
              <span className="inline-flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Prêmio ⇄ Preço por trading
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-small text-fg-3">
              Para cada trading informe <span className="text-fg-2 font-medium">o prêmio</span> (¢/bu)
              <span className="text-fg-2 font-medium"> ou o preço de balcão</span> (R$/sc). A mesa
              forma o preço, deriva o prêmio implícito e calcula o spread. Ordenado por melhor preço.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-left text-fg-3 border-b border-[var(--border)]">
                    <th className="py-2 pr-3 font-semibold">Trading</th>
                    <th className="py-2 px-2 font-semibold">Prêmio ¢/bu</th>
                    <th className="py-2 px-2 font-semibold">Preço balcão R$/sc</th>
                    <th className="py-2 px-2 font-semibold text-right">Preço formado</th>
                    <th className="py-2 px-2 font-semibold text-right">Prêmio implícito</th>
                    <th className="py-2 px-2 font-semibold text-right">Spread US$/bu</th>
                    <th className="py-2 pl-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {comparadas.map((c) => {
                    const idx = linhas.findIndex((x) => x.nome === c.nome)
                    if (idx < 0) return null
                    const linha = linhas[idx]
                    const eMelhorPreco = c.nome === melhorPrecoNome && temAlgumDado
                    const eMelhorSpread = c.nome === melhorSpreadNome && resumo.melhorSpread != null
                    return (
                      <tr
                        key={c.nome}
                        className={`border-b border-[var(--border)]/40 ${
                          eMelhorPreco ? 'bg-[var(--bg-2)]' : ''
                        }`}
                      >
                        <td className="py-1.5 pr-3 font-medium text-fg-1">
                          <span className="inline-flex items-center gap-1.5">
                            {eMelhorPreco ? (
                              <Trophy className="h-3.5 w-3.5 text-accent shrink-0" />
                            ) : null}
                            {c.nome}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={linha.premio}
                            onChange={(e) => {
                              const v = e.target.value
                              setLinhas((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, premio: v } : x)),
                              )
                            }}
                            placeholder="55"
                            className="w-20 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2 py-1 text-fg-1 focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={linha.precoBalcao}
                            onChange={(e) => {
                              const v = e.target.value
                              setLinhas((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, precoBalcao: v } : x)),
                              )
                            }}
                            placeholder="125,00"
                            className="w-24 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2 py-1 text-fg-1 focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-fg-1">
                          {c.precoFormadoBrlSc > 0 ? fmtBRL(c.precoFormadoBrlSc) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-fg-2">
                          {c.premioImplicitoUsdBu != null ? fmtUsdBu(c.premioImplicitoUsdBu) : '—'}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right tabular-nums font-semibold ${
                            c.spread == null
                              ? 'text-fg-3'
                              : c.spread >= 0
                                ? 'text-accent'
                                : 'text-danger'
                          }`}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            {eMelhorSpread ? <TrendingUp className="h-3 w-3 shrink-0" /> : null}
                            {c.spread != null ? fmtUsdBu(c.spread) : '—'}
                          </span>
                        </td>
                        <td className="py-1.5 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-fg-3 hover:text-danger focus:outline-none"
                            title="Remover trading"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {comparadas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-fg-3">
                        Nenhuma trading na mesa. Adicione abaixo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <AddRow
              onAdd={(nome) =>
                setLinhas((prev) =>
                  prev.some((x) => x.nome.toLowerCase() === nome.toLowerCase())
                    ? prev
                    : [...prev, { nome, premio: '', precoBalcao: '' }],
                )
              }
              placeholder="Nova trading…"
            />

            <p className="text-small text-fg-3 pt-1">
              <span className="text-accent">Spread &gt; 0</span>: o preço de balcão embute mais prêmio
              do que a trading divulga (paga melhor do que diz). Total de {resumo.totalTradings}{' '}
              trading(s) na mesa.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/** Linha de adição de trading. */
function AddRow({ onAdd, placeholder }: { onAdd: (nome: string) => void; placeholder: string }) {
  const [nome, setNome] = React.useState('')
  function add() {
    const n = nome.trim()
    if (!n) return
    onAdd(n)
    setNome('')
  }
  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add()
        }}
        placeholder={placeholder}
        className="flex-1 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2.5 py-1.5 text-small text-fg-1 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={add}>
        Adicionar
      </Button>
    </div>
  )
}
