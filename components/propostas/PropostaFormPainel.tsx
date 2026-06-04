'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Send,
  Plus,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Card, Button, Input, Select } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { KG_POR_SC } from '@/lib/cotacoes/unidades'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  verificarPrecoNaBanda,
  type BandaCliente,
} from '@/lib/propostas/sugestao-preco'

interface Cliente {
  id: string
  nome: string
}

export interface PropostaFormPainelProps {
  cliente: Cliente
  marginsMap: Record<string, number>
  /** Disparado quando operador clica em "trocar cliente". */
  onTrocarCliente: () => void
}

interface SugestaoResponse {
  sugeridoClienteBrlTon: number | null
  sugeridoBaseBrlTon: number | null
  precoMercadoBrlTon: number | null
  fonteMercado: 'CBOT' | 'Cotacao' | 'indisponivel'
  bandaCliente: BandaCliente | null
  warnings: string[]
}

type Tipo = 'venda' | 'compra'
type UnidadeQtd = 't' | 'sc60'
type UnidadePreco = 'brlTon' | 'brlSc60'

const TIPO_OPTIONS = [
  { value: 'venda', label: 'Venda' },
  { value: 'compra', label: 'Compra' },
]

const GRAOS_OPTIONS = [
  { value: '', label: 'Selecione o grão' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
  { value: 'aveia', label: 'Aveia' },
  { value: 'arroz', label: 'Arroz' },
  { value: 'cafe', label: 'Café' },
  { value: 'algodao', label: 'Algodão' },
]

export function PropostaFormPainel({
  cliente,
  marginsMap,
  onTrocarCliente,
}: PropostaFormPainelProps) {
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [tipo, setTipo] = useState<Tipo>('venda')
  const [grao, setGrao] = useState<string>('')
  const [unidadeQtd, setUnidadeQtd] = useState<UnidadeQtd>('sc60')
  const [quantidadeInput, setQuantidadeInput] = useState<string>('')
  const [unidadePreco, setUnidadePreco] = useState<UnidadePreco>('brlSc60')
  const [precoInput, setPrecoInput] = useState<string>('')
  const [precoFoiEditado, setPrecoFoiEditado] = useState(false)
  const [validadeEm, setValidadeEm] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [local, setLocal] = useState<string>('')
  const [descricao, setDescricao] = useState<string>('')
  const [sugestao, setSugestao] = useState<SugestaoResponse | null>(null)
  const [carregandoSugestao, setCarregandoSugestao] = useState(false)
  const [criando, setCriando] = useState(false)

  // Busca sugestão sempre que grão muda + cliente identificado
  useEffect(() => {
    if (!grao) {
      setSugestao(null)
      return
    }
    setCarregandoSugestao(true)
    const params = new URLSearchParams({ grao, clienteId: cliente.id, tipo })
    fetch(`/api/propostas/sugestao-preco?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setSugestao(j as SugestaoResponse)
          // Auto-preenche o preço se ainda não foi editado pelo operador
          if (!precoFoiEditado) {
            const recomendado =
              j.sugeridoClienteBrlTon ?? j.sugeridoBaseBrlTon ?? null
            if (recomendado) {
              setPrecoInput(formatarPreco(recomendado, unidadePreco, grao))
            }
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setCarregandoSugestao(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grao, cliente.id, tipo])

  // ── Cálculos derivados ──
  const quantidadeTon = parseQuantidade(quantidadeInput, unidadeQtd, grao)
  const precoBrlTon = parsePreco(precoInput, unidadePreco, grao)
  const subtotal =
    quantidadeTon > 0 && precoBrlTon > 0 ? quantidadeTon * precoBrlTon : 0
  const margemPct = grao ? marginsMap[grao] : undefined
  const margemProjetada =
    margemPct != null && precoBrlTon > 0 && quantidadeTon > 0
      ? precoBrlTon * (margemPct / 100) * quantidadeTon
      : 0

  // Verifica banda histórica do cliente
  const verificacaoBanda =
    precoBrlTon > 0 && sugestao?.bandaCliente
      ? verificarPrecoNaBanda(precoBrlTon, sugestao.bandaCliente)
      : null

  const podeCriar =
    !!grao && quantidadeTon > 0 && precoBrlTon > 0 && !!validadeEm

  const usarSugestao = (valorBrlTon: number) => {
    setPrecoInput(formatarPreco(valorBrlTon, unidadePreco, grao))
    setPrecoFoiEditado(false)
  }

  const handleSubmit = async (enviar: boolean) => {
    if (!podeCriar) {
      showError('Preencha grão, quantidade, preço e validade')
      return
    }
    setCriando(true)
    try {
      const subtotalArred = Math.round(quantidadeTon * precoBrlTon * 100) / 100
      const payload = {
        clienteId: cliente.id,
        tipo,
        validadeEm,
        valor: subtotalArred,
        canalAutorizacao: 'web',
        ...(local ? { origem: local } : {}),
        ...(descricao ? { descricao } : {}),
        graos: [
          {
            grao,
            quantidade: quantidadeTon,
            preco: precoBrlTon,
            subtotal: subtotalArred,
          },
        ],
      }
      const r = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao criar proposta')
      }
      const proposta = await r.json()
      success(`Proposta ${proposta.numero ?? ''} criada`)

      if (enviar && proposta.id) {
        const r2 = await fetch(
          `/api/bhgrain/propostas/${proposta.id}/enviar`,
          { method: 'POST' }
        )
        if (r2.ok) success('Proposta enviada')
        else showError('Proposta criada mas falhou envio')
      }
      router.push('/propostas')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setCriando(false)
    }
  }

  const recomendado =
    sugestao?.sugeridoClienteBrlTon ?? sugestao?.sugeridoBaseBrlTon ?? null

  return (
    <Card className="space-y-5">
      {/* Header: cliente fixo + trocar */}
      <div
        className="flex items-center justify-between gap-3 pb-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full shrink-0"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow" style={{ fontSize: 10 }}>Cliente</p>
            <p className="text-fg-1 font-semibold truncate">{cliente.nome}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTrocarCliente}
          className="chip"
          style={{ padding: '6px 10px', fontSize: 11 }}
        >
          <X className="h-3 w-3 mr-1" />
          Trocar
        </button>
      </div>

      {/* Tipo + Grão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Tipo"
          options={TIPO_OPTIONS}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
        />
        <Select
          label="Grão"
          options={GRAOS_OPTIONS}
          value={grao}
          onChange={(e) => {
            setGrao(e.target.value)
            setPrecoFoiEditado(false)
          }}
        />
      </div>

      {/* Quantidade */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="eyebrow">Quantidade</label>
          <div className="flex gap-1">
            {(['sc60', 't'] as UnidadeQtd[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnidadeQtd(u)}
                className={unidadeQtd === u ? 'chip active' : 'chip'}
                style={{ fontSize: 10, padding: '2px 8px' }}
              >
                {u === 't' ? 'toneladas' : 'sacas (60kg)'}
              </button>
            ))}
          </div>
        </div>
        <Input
          type="number"
          step="0.01"
          value={quantidadeInput}
          onChange={(e) => setQuantidadeInput(e.target.value)}
          placeholder={unidadeQtd === 't' ? 'Ex: 60' : 'Ex: 1000'}
        />
        {quantidadeTon > 0 && (
          <p className="text-fg-3 text-[11px] mt-1 tabular-nums">
            ≡ {quantidadeTon.toFixed(2)} t
            {grao && unidadeQtd !== 't' && (
              <span>
                {' '}
                · {((quantidadeTon * 1000) / KG_POR_SC[grao as keyof typeof KG_POR_SC]).toFixed(0)} sc60
              </span>
            )}
          </p>
        )}
      </div>

      {/* Preço com sugestão automática */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="eyebrow">Preço</label>
          <div className="flex gap-1">
            {(['brlSc60', 'brlTon'] as UnidadePreco[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  // Mantém preço canônico ao trocar unidade
                  if (precoBrlTon > 0) {
                    setPrecoInput(formatarPreco(precoBrlTon, u, grao))
                  }
                  setUnidadePreco(u)
                }}
                className={unidadePreco === u ? 'chip active' : 'chip'}
                style={{ fontSize: 10, padding: '2px 8px' }}
              >
                {u === 'brlTon' ? 'R$/t' : 'R$/sc'}
              </button>
            ))}
          </div>
        </div>
        <Input
          type="number"
          step="0.01"
          value={precoInput}
          onChange={(e) => {
            setPrecoInput(e.target.value)
            setPrecoFoiEditado(true)
          }}
          placeholder={unidadePreco === 'brlTon' ? 'Ex: 2200' : 'Ex: 130'}
        />

        {/* Chip de sugestão (quando temos grão + cliente) */}
        {grao && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {carregandoSugestao && (
              <span className="text-fg-3 text-[11px] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculando sugestão…
              </span>
            )}
            {!carregandoSugestao && recomendado && (
              <button
                type="button"
                onClick={() => usarSugestao(recomendado)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(200,240,81,0.3)',
                }}
                title="Clique para usar este preço"
              >
                <Lightbulb className="h-3 w-3" />
                {sugestao?.sugeridoClienteBrlTon
                  ? 'Sugestão cliente'
                  : 'Sugestão padrão'}{' '}
                : R$ {recomendado.toFixed(2)}/t
                {grao && (
                  <span className="opacity-60">
                    · R$ {((recomendado * KG_POR_SC[grao as keyof typeof KG_POR_SC]) / 1000).toFixed(2)}/sc
                  </span>
                )}
              </button>
            )}
            {sugestao?.precoMercadoBrlTon && (
              <span className="text-fg-3 text-[10px] tabular-nums">
                mercado R$ {sugestao.precoMercadoBrlTon.toFixed(2)}/t
              </span>
            )}
          </div>
        )}

        {/* Avisos */}
        {precoBrlTon > 0 && verificacaoBanda && verificacaoBanda.status !== 'dentro' && sugestao?.bandaCliente && (
          <div className="text-warn text-[11px] flex items-center gap-1 mt-1.5">
            <AlertTriangle className="h-3 w-3" />
            Preço {(verificacaoBanda.desvioPct * 100).toFixed(1)}%{' '}
            {verificacaoBanda.status === 'acima' ? 'acima' : 'abaixo'} da banda histórica deste cliente
            (R$ {sugestao.bandaCliente.minBrlTon.toFixed(0)}–{sugestao.bandaCliente.maxBrlTon.toFixed(0)}/t)
          </div>
        )}
      </div>

      {/* Validade + Local */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Validade"
          type="date"
          value={validadeEm}
          onChange={(e) => setValidadeEm(e.target.value)}
        />
        <Input
          label="Local (opcional)"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Ex: Sorriso/MT"
        />
      </div>

      {/* Descrição */}
      <div>
        <label className="eyebrow block mb-1.5">Observações (opcional)</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Condições especiais, observações comerciais…"
          className="w-full px-4 py-2.5 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
        />
      </div>

      {/* Resumo */}
      {subtotal > 0 && (
        <div
          className="rounded-md p-3 space-y-1.5"
          style={{
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between text-small">
            <span className="text-fg-3">Subtotal</span>
            <span className="text-accent font-semibold tabular-nums">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {margemProjetada > 0 && (
            <div className="flex items-center justify-between text-small">
              <span className="text-fg-3">Margem projetada · {margemPct?.toFixed(2)}%</span>
              <span className="text-pos font-semibold tabular-nums">
                {formatCurrency(margemProjetada)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      <div
        className="flex items-center justify-between gap-3 pt-3 flex-wrap"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-fg-3 text-[11px]">
          {podeCriar ? (
            <>Pronto para criar.</>
          ) : (
            <>Preencha grão, quantidade, preço e validade.</>
          )}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!podeCriar}
            loading={criando}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => handleSubmit(false)}
          >
            Criar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!podeCriar}
            loading={criando}
            leftIcon={<Send className="h-3.5 w-3.5" />}
            onClick={() => handleSubmit(true)}
          >
            Criar e enviar
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Helpers de conversão ──

function parseQuantidade(input: string, unidade: UnidadeQtd, grao: string): number {
  const n = parseFloat(input.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 0
  if (unidade === 't') return n
  // sacas para t
  const kgPorSc = grao ? KG_POR_SC[grao as keyof typeof KG_POR_SC] ?? 60 : 60
  return (n * kgPorSc) / 1000
}

function parsePreco(input: string, unidade: UnidadePreco, grao: string): number {
  const n = parseFloat(input.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 0
  if (unidade === 'brlTon') return n
  // R$/sc → R$/t
  const kgPorSc = grao ? KG_POR_SC[grao as keyof typeof KG_POR_SC] ?? 60 : 60
  return (n / kgPorSc) * 1000
}

function formatarPreco(brlTon: number, unidade: UnidadePreco, grao: string): string {
  if (unidade === 'brlTon') return brlTon.toFixed(2)
  const kgPorSc = grao ? KG_POR_SC[grao as keyof typeof KG_POR_SC] ?? 60 : 60
  return ((brlTon * kgPorSc) / 1000).toFixed(2)
}
