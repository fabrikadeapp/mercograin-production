'use client'

import * as React from 'react'
import { TrendingUp, MapPin, Building2, RefreshCw, Save, Check, Plus, Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Chip,
  GrainBadge,
  Button,
} from '@/components/ui/phb'
import {
  simularPrecoGrao,
  simularTradings,
  simularPracas,
  type GraoSimulador,
  type SimuladorInput,
  type TradingInput,
  type PracaInput,
} from '@/lib/cotacoes/simulador'

type GraoLabel = 'soja' | 'milho' | 'trigo'

export interface CotacoesIniciais {
  /** CBOT ¢/bu por grão (do banco, automatizado; null se indisponível). */
  cbot: Record<GraoLabel, number | null>
  /** Câmbio USD/BRL (BCB PTAX do banco; null se indisponível). */
  cambio: number | null
  /** Data ISO da cotação usada (para exibir "atualizado em"). */
  dataCotacao: string | null
}

export interface SimuladorConfigDTO {
  fobbingsUsdTon: number
  tradings: TradingInput[]
  pracas: PracaInput[]
}

interface Props {
  cotacoes: CotacoesIniciais
  config: SimuladorConfigDTO | null
}

const GRAOS: { value: GraoSimulador; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
]

/** Tradings padrão (espelha a planilha SIMULADOR CBOT AUTO) — usado se não há config salva. */
const TRADINGS_DEFAULT: TradingInput[] = [
  { nome: 'Bianchini', premioCentavosBu: 0 },
  { nome: 'ADM', premioCentavosBu: 0 },
  { nome: 'Amaggi', premioCentavosBu: 0 },
  { nome: 'Cargill', premioCentavosBu: 0 },
  { nome: 'Bunge', premioCentavosBu: 0 },
  { nome: 'LDC', premioCentavosBu: 0 },
  { nome: 'COFCO', premioCentavosBu: 0 },
  { nome: 'Gavilon', premioCentavosBu: 0 },
  { nome: 'Olam', premioCentavosBu: 0 },
]

/** Praças do RS com frete rodoviário até o porto (R$/saca). Espelha a planilha. */
const PRACAS_DEFAULT: PracaInput[] = [
  { nome: 'Cruz Alta', fretePorSacaBrl: 3.0 },
  { nome: 'Júlio de Castilhos', fretePorSacaBrl: 3.0 },
  { nome: 'Tapera', fretePorSacaBrl: 3.3 },
  { nome: 'Santa Bárbara', fretePorSacaBrl: 3.3 },
  { nome: 'Palmeira', fretePorSacaBrl: 3.0 },
  { nome: 'Soledade', fretePorSacaBrl: 3.3 },
  { nome: 'Não-Me-Toque', fretePorSacaBrl: 3.6 },
  { nome: 'Erechim', fretePorSacaBrl: 4.2 },
  { nome: 'Estação Velha', fretePorSacaBrl: 3.3 },
  { nome: 'Pontão', fretePorSacaBrl: 3.3 },
]

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtUSD(n: number): string {
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SimuladorContent({ cotacoes, config }: Props) {
  const [grao, setGrao] = React.useState<GraoSimulador>('soja')
  const [cbot, setCbot] = React.useState<number>(() => cotacoes.cbot.soja ?? 0)
  const [premio, setPremio] = React.useState<number>(0)
  const [fobbings, setFobbings] = React.useState<number>(config?.fobbingsUsdTon ?? -10)
  const [cambio, setCambio] = React.useState<number>(() => cotacoes.cambio ?? 0)
  const [frete, setFrete] = React.useState<number>(3)

  const [tradings, setTradings] = React.useState<TradingInput[]>(
    () => config?.tradings?.length ? config.tradings : TRADINGS_DEFAULT,
  )
  const [pracas, setPracas] = React.useState<PracaInput[]>(
    () => config?.pracas?.length ? config.pracas : PRACAS_DEFAULT,
  )

  // Estado de salvamento da config
  const [salvando, setSalvando] = React.useState(false)
  const [salvoEm, setSalvoEm] = React.useState<number | null>(null)
  const [erroSalvar, setErroSalvar] = React.useState<string | null>(null)

  function cbotDoGrao(g: GraoSimulador): number | null {
    return cotacoes.cbot[g]
  }

  // Ao trocar de grão, recarrega o CBOT da cotação daquele grão (se houver).
  function trocarGrao(g: GraoSimulador) {
    setGrao(g)
    const c = cbotDoGrao(g)
    if (c != null) setCbot(c)
  }

  function restaurarCotacao() {
    const c = cbotDoGrao(grao)
    if (c != null) setCbot(c)
    if (cotacoes.cambio != null) setCambio(cotacoes.cambio)
  }

  async function salvarConfig() {
    setSalvando(true)
    setErroSalvar(null)
    try {
      const res = await fetch('/api/simulador-cbot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fobbingsUsdTon: fobbings, tradings, pracas }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setSalvoEm(Date.now())
      setTimeout(() => setSalvoEm(null), 3000)
    } catch (e: any) {
      setErroSalvar(e?.message || 'Falha ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const input: SimuladorInput = {
    grao,
    cbotCentavosBu: cbot,
    premioCentavosBu: premio,
    fobbingsUsdTon: fobbings,
    cambioUsdBrl: cambio,
    fretePorSacaBrl: frete,
  }

  const result = React.useMemo(() => simularPrecoGrao(input), [
    grao,
    cbot,
    premio,
    fobbings,
    cambio,
    frete,
  ])

  const tradingsResult = React.useMemo(
    () =>
      simularTradings(
        { grao, cbotCentavosBu: cbot, fobbingsUsdTon: fobbings, cambioUsdBrl: cambio, fretePorSacaBrl: frete },
        tradings,
      ),
    [grao, cbot, fobbings, cambio, frete, tradings],
  )

  const pracasResult = React.useMemo(
    () =>
      simularPracas(
        { grao, cbotCentavosBu: cbot, premioCentavosBu: premio, fobbingsUsdTon: fobbings, cambioUsdBrl: cambio },
        pracas,
      ),
    [grao, cbot, premio, fobbings, cambio, pracas],
  )

  const temCotacao = cbotDoGrao(grao) != null || cotacoes.cambio != null
  const dataLabel = cotacoes.dataCotacao
    ? new Date(cotacoes.dataCotacao).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* COLUNA INPUTS */}
        <div className="space-y-4">
          {/* Parâmetros de mercado */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Mercado">Parâmetros de formação de preço</CardTitle>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  label="Prêmio (basis)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={premio || ''}
                  onChange={(e) => setPremio(parseFloat(e.target.value) || 0)}
                  rightAddon="¢/bu"
                  placeholder="55"
                  helperText="Prêmio de exportação no porto"
                />
                <Input
                  label="FOBBINGS"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={fobbings || ''}
                  onChange={(e) => setFobbings(parseFloat(e.target.value) || 0)}
                  rightAddon="US$/t"
                  placeholder="-10"
                  helperText="Custo de embarque (negativo)"
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

              <div className="flex items-center gap-2 flex-wrap">
                {temCotacao ? (
                  <>
                    <Chip variant="info">
                      Cotações automáticas{dataLabel ? ` · ${dataLabel}` : ''}
                    </Chip>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RefreshCw className="h-4 w-4" />}
                      onClick={restaurarCotacao}
                    >
                      Restaurar cotação atual
                    </Button>
                  </>
                ) : (
                  <Chip variant="neutral">Cotação automática indisponível — insira manualmente</Chip>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Tradings — prêmio próprio por comprador */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Compradores">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Trading spot price
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-small text-fg-3">
                Cada comprador com seu prêmio próprio (¢/bu). Ranqueado por preço FOB origem — quem paga mais.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead>
                    <tr className="text-left text-fg-3 border-b border-[var(--border)]">
                      <th className="py-2 pr-3 font-semibold">Trading</th>
                      <th className="py-2 px-2 font-semibold">Prêmio ¢/bu</th>
                      <th className="py-2 px-2 font-semibold text-right">US$/sc</th>
                      <th className="py-2 px-2 font-semibold text-right">R$/sc origem</th>
                      <th className="py-2 pl-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradingsResult.map((t) => {
                      const idx = tradings.findIndex((x) => x.nome === t.nome)
                      return (
                        <tr key={t.nome} className="border-b border-[var(--border)]/40">
                          <td className="py-1.5 pr-3 font-medium text-fg-1">{t.nome}</td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={tradings[idx]?.premioCentavosBu || ''}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0
                                setTradings((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, premioCentavosBu: v } : x)),
                                )
                              }}
                              placeholder="0"
                              className="w-20 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2 py-1 text-fg-1 focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-fg-2">
                            {fmtUSD(t.usdPorSaca)}
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-fg-1">
                            {fmtBRL(t.brlPorSacaFobOrigem)}
                          </td>
                          <td className="py-1.5 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => setTradings((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-fg-3 hover:text-danger focus:outline-none"
                              title="Remover trading"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <AddRow
                onAdd={(nome) => setTradings((prev) => [...prev, { nome, premioCentavosBu: 0 }])}
                placeholder="Nova trading…"
              />
            </CardBody>
          </Card>

          {/* Praças — frete por cidade */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Praças (RS)">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Preço FOB origem por cidade
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-small text-fg-3">
                Preço-porteira por praça, descontando o frete até o porto. Usa o prêmio principal acima.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead>
                    <tr className="text-left text-fg-3 border-b border-[var(--border)]">
                      <th className="py-2 pr-3 font-semibold">Praça</th>
                      <th className="py-2 px-2 font-semibold">Frete R$/sc</th>
                      <th className="py-2 px-2 font-semibold text-right">R$/sc origem</th>
                      <th className="py-2 pl-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pracasResult.map((p) => {
                      const idx = pracas.findIndex((x) => x.nome === p.nome)
                      return (
                        <tr key={p.nome} className="border-b border-[var(--border)]/40">
                          <td className="py-1.5 pr-3 font-medium text-fg-1">{p.nome}</td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pracas[idx]?.fretePorSacaBrl || ''}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0
                                setPracas((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, fretePorSacaBrl: v } : x)),
                                )
                              }}
                              placeholder="0"
                              className="w-20 rounded-md bg-[var(--bg-2)] border border-[var(--border)] px-2 py-1 text-fg-1 focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-fg-1">
                            {fmtBRL(p.brlPorSacaFobOrigem)}
                          </td>
                          <td className="py-1.5 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => setPracas((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-fg-3 hover:text-danger focus:outline-none"
                              title="Remover praça"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <AddRow
                onAdd={(nome) => setPracas((prev) => [...prev, { nome, fretePorSacaBrl: 0 }])}
                placeholder="Nova praça…"
              />
            </CardBody>
          </Card>
        </div>

        {/* COLUNA RESULTADO */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <Card className="border-accent/40">
            <CardHeader>
              <CardTitle eyebrow="Resultado">
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Preço formado
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-1">
                <p className="eyebrow">Preço FOB porto</p>
                <p className="text-h2 font-bold text-fg-1 tabular-nums">
                  {fmtBRL(result.brlPorSacaPorto)}
                  <span className="text-small font-normal text-fg-3"> /sc</span>
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-[var(--border)]">
                <p className="eyebrow">Preço FOB origem (porteira)</p>
                <p className="text-h1 font-bold text-accent tabular-nums">
                  {fmtBRL(result.brlPorSacaFobOrigem)}
                  <span className="text-small font-normal text-fg-3"> /sc</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                <div>
                  <p className="eyebrow">US$/saca</p>
                  <p className="text-body font-semibold text-fg-2 tabular-nums">{fmtUSD(result.usdPorSaca)}</p>
                </div>
                <div>
                  <p className="eyebrow">US$/tonelada</p>
                  <p className="text-body font-semibold text-fg-2 tabular-nums">
                    {fmtUSD(result.usdPorToneladaLiquido)}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Detalhamento passo a passo */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Formação">Passo a passo</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {result.linhas.map((l, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-small">
                    <div className="min-w-0">
                      <span className="font-medium text-fg-1">{l.rotulo}</span>
                      {l.detalhe ? <p className="text-fg-3 truncate">{l.detalhe}</p> : null}
                    </div>
                    <span
                      className={`tabular-nums shrink-0 font-semibold ${
                        l.valor < 0 ? 'text-danger' : 'text-fg-2'
                      }`}
                    >
                      {l.valor < 0 ? '−' : ''}
                      {Math.abs(l.valor).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-fg-3 font-normal">{l.unidade}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Salvar config da mesa */}
          <Card>
            <CardBody>
              <p className="text-small text-fg-3">
                Salve prêmios, fretes e FOBBINGS desta mesa para não redigitar amanhã.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={
                    salvoEm ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />
                  }
                  onClick={salvarConfig}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando…' : salvoEm ? 'Salvo' : 'Salvar configuração'}
                </Button>
                {erroSalvar ? (
                  <span className="text-small text-danger">{erroSalvar}</span>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Linha de adição de item (trading/praça). */
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
