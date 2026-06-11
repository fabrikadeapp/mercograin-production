'use client'

import * as React from 'react'
import { Calculator, RefreshCw, Plus, Trash2, Clock, Building2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardBody, Chip, Button } from '@/components/ui/phb'
import {
  calcularGradePremios,
  tradingsPremiosDefault,
  mesesDefault,
  type MesVencimento,
  type TradingPremios,
} from '@/lib/cotacoes/premios'

/** Dados à vista pré-carregados no servidor para preencher o MÊS CORRENTE. */
export interface SpotInicial {
  /** Câmbio USD/BRL à vista (null se indisponível). */
  cambio: number | null
  /** CBOT (Chicago) da soja em US$/bushel à vista (null se indisponível). */
  chicagoSojaUsdBu: number | null
  /** Data base ISO (YYYY-MM-DD) para rotular os meses de vencimento. */
  dataBaseISO: string
  /** Timestamp ISO da última atualização dos dados à vista. */
  atualizadoEm: string
}

interface Props {
  spot: SpotInicial
}

/** Quantidade de meses de vencimento exibidos na grade (curva). */
const QTD_MESES = 5

function fmtPremio(n: number): string {
  // Prêmio em US$/bushel — exibe com sinal e 2 casas (centavos de dólar/bu).
  const sinal = n < 0 ? '−' : ''
  return `${sinal}${Math.abs(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function PremiosContent({ spot }: Props) {
  // ── Meses de vencimento (curva) ───────────────────────────────────────────
  // O mês corrente (índice 0) é pré-preenchido com o spot ao vivo; os demais
  // começam zerados para o operador montar a curva.
  const [meses, setMeses] = React.useState<MesVencimento[]>(() => {
    const base = mesesDefault(spot.dataBaseISO, QTD_MESES)
    return base.map((m, i) =>
      i === 0
        ? {
            ...m,
            cambio: spot.cambio ?? 0,
            chicagoUsdBu: spot.chicagoSojaUsdBu ?? 0,
          }
        : m,
    )
  })

  // ── Tradings × preço de balcão por mês ────────────────────────────────────
  const [tradings, setTradings] = React.useState<TradingPremios[]>(() =>
    tradingsPremiosDefault(QTD_MESES),
  )

  // ── Atualização forçada das cotações à vista (mês corrente) ───────────────
  const [atualizando, setAtualizando] = React.useState(false)
  const [erroAtualizar, setErroAtualizar] = React.useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = React.useState<string>(spot.atualizadoEm)

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
        cambio: number | null
        cbot: { soja: number | null; milho: number | null; trigo: number | null }
        atualizadoEm?: string
      }
      // CBOT do forcar vem em ¢/bu → US$/bu (÷100). Atualiza só o mês corrente.
      const novoCambio = j.cambio
      const novoChicago = j.cbot?.soja != null ? j.cbot.soja / 100 : null
      setMeses((prev) =>
        prev.map((m, i) =>
          i === 0
            ? {
                ...m,
                cambio: novoCambio ?? m.cambio,
                chicagoUsdBu: novoChicago ?? m.chicagoUsdBu,
              }
            : m,
        ),
      )
      setAtualizadoEm(j.atualizadoEm || new Date().toISOString())
    } catch (e: any) {
      setErroAtualizar(e?.message || 'Falha ao atualizar cotações')
    } finally {
      setAtualizando(false)
    }
  }

  // ── Grade de prêmios implícitos [trading × mês] em tempo real ─────────────
  const grade = React.useMemo(
    () => calcularGradePremios(tradings, meses),
    [tradings, meses],
  )

  // Melhor prêmio (maior) por mês, para destacar a célula campeã.
  const melhorPorMes = React.useMemo<(number | null)[]>(() => {
    return meses.map((_, col) => {
      let melhor: number | null = null
      for (const linha of grade) {
        const v = linha.premios[col]
        if (v == null) continue
        if (melhor == null || v > melhor) melhor = v
      }
      return melhor
    })
  }, [grade, meses])

  // ── Handlers de edição ────────────────────────────────────────────────────
  function setCambioMes(col: number, v: number) {
    setMeses((prev) => prev.map((m, i) => (i === col ? { ...m, cambio: v } : m)))
  }
  function setChicagoMes(col: number, v: number) {
    setMeses((prev) => prev.map((m, i) => (i === col ? { ...m, chicagoUsdBu: v } : m)))
  }
  function setPrecoCelula(linhaIdx: number, col: number, v: number | null) {
    setTradings((prev) =>
      prev.map((t, i) =>
        i === linhaIdx
          ? { ...t, precosPorMes: t.precosPorMes.map((p, j) => (j === col ? v : p)) }
          : t,
      ),
    )
  }
  function adicionarTrading(nome: string) {
    setTradings((prev) => [
      ...prev,
      { nome, precosPorMes: Array.from({ length: meses.length }, () => null) },
    ])
  }
  function removerTrading(linhaIdx: number) {
    setTradings((prev) => prev.filter((_, i) => i !== linhaIdx))
  }

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

  const inputCellCls =
    'w-24 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2 py-1 text-fg-1 text-small tabular-nums focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="space-y-4">
      {/* Barra de atualização das cotações à vista */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-3 flex-wrap">
            <Chip variant="info">Cotações à vista (mês corrente)</Chip>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className={`h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />}
              onClick={atualizarAgora}
              disabled={atualizando}
            >
              {atualizando ? 'Atualizando…' : 'Atualizar agora'}
            </Button>
            {atualizadoLabel ? (
              <p className="text-small text-fg-3 inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Dados atualizados em{' '}
                <span className="text-fg-2 font-medium">{atualizadoLabel}</span>
              </p>
            ) : null}
            {erroAtualizar ? (
              <span className="text-small text-danger">{erroAtualizar}</span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Grade trading × mês */}
      <Card>
        <CardHeader>
          <CardTitle eyebrow="Curva de prêmios">
            <span className="inline-flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Prêmio implícito por trading × mês
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-small text-fg-3">
            Digite o <strong>preço de balcão</strong> (R$/saca de 60 kg) em cada célula. O prêmio
            implícito (US$/bushel) é calculado em tempo real com o câmbio e o Chicago de cada mês.
            O melhor prêmio de cada mês é destacado.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-small border-collapse">
              <thead>
                {/* Linha 1: rótulos dos meses */}
                <tr className="text-left text-fg-3 border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-semibold align-bottom sticky left-0 bg-[var(--bg-2)] z-10">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> Trading
                    </span>
                  </th>
                  {meses.map((m, col) => (
                    <th key={col} className="py-2 px-2 font-semibold text-center min-w-[8rem]">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2 pl-2 w-8"></th>
                </tr>
                {/* Linha 2: câmbio editável por mês */}
                <tr className="text-left text-fg-3 border-b border-[var(--border)]/60">
                  <th className="py-1.5 pr-3 font-normal text-fg-3 sticky left-0 bg-[var(--bg-2)] z-10">
                    Câmbio USD/BRL
                  </th>
                  {meses.map((m, col) => (
                    <th key={col} className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        step="0.0001"
                        inputMode="decimal"
                        value={m.cambio || ''}
                        onChange={(e) => setCambioMes(col, parseFloat(e.target.value) || 0)}
                        placeholder="5,40"
                        className={inputCellCls}
                      />
                    </th>
                  ))}
                  <th></th>
                </tr>
                {/* Linha 3: Chicago editável por mês */}
                <tr className="text-left text-fg-3 border-b border-[var(--border)]">
                  <th className="py-1.5 pr-3 font-normal text-fg-3 sticky left-0 bg-[var(--bg-2)] z-10">
                    Chicago US$/bu
                  </th>
                  {meses.map((m, col) => (
                    <th key={col} className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={m.chicagoUsdBu || ''}
                        onChange={(e) => setChicagoMes(col, parseFloat(e.target.value) || 0)}
                        placeholder="11,20"
                        className={inputCellCls}
                      />
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tradings.map((t, linhaIdx) => (
                  <tr key={`${t.nome}-${linhaIdx}`} className="border-b border-[var(--border)]/40">
                    <td className="py-1.5 pr-3 font-medium text-fg-1 sticky left-0 bg-[var(--bg-2)] z-10">
                      {t.nome}
                    </td>
                    {meses.map((_, col) => {
                      const preco = t.precosPorMes[col]
                      const premio = grade[linhaIdx]?.premios[col] ?? null
                      const melhor = melhorPorMes[col]
                      const ehMelhor =
                        premio != null && melhor != null && premio === melhor
                      return (
                        <td key={col} className="py-1.5 px-2 text-center align-top">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={preco ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                setPrecoCelula(
                                  linhaIdx,
                                  col,
                                  raw === '' ? null : parseFloat(raw) || 0,
                                )
                              }}
                              placeholder="R$/sc"
                              className={inputCellCls}
                            />
                            <span
                              className={`text-small tabular-nums font-semibold ${
                                premio == null
                                  ? 'text-fg-3'
                                  : ehMelhor
                                    ? 'text-accent'
                                    : premio < 0
                                      ? 'text-danger'
                                      : 'text-fg-2'
                              }`}
                            >
                              {premio == null ? '—' : fmtPremio(premio)}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                    <td className="py-1.5 pl-2 text-right align-top">
                      <button
                        type="button"
                        onClick={() => removerTrading(linhaIdx)}
                        className="text-fg-3 hover:text-danger focus:outline-none"
                        title="Remover trading"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AddRow onAdd={adicionarTrading} placeholder="Nova trading…" />

          <p className="text-small text-fg-3 pt-1">
            Prêmio em US$/bushel. Valores em <span className="text-accent font-medium">verde</span>{' '}
            indicam o melhor prêmio do mês.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

/** Linha de adição de trading. */
function AddRow({
  onAdd,
  placeholder,
}: {
  onAdd: (nome: string) => void
  placeholder: string
}) {
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
