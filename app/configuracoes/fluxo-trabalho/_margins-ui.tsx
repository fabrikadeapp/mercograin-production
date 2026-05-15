'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2, Sparkles, Edit2 } from 'lucide-react'
import { saveMargin, removeMargin, applySeedMargins } from './_actions'
import { SUPPORTED_COMMODITIES, calcularMargem, type MarginRule } from '@/lib/bhgrain/margin-rules'

interface Props {
  rules: MarginRule[]
  /** Preço de referência da soja (R$/sc) — usado para exibir exemplo de margem em R$. */
  precoRefSoja: number | null
}

const COMMODITY_LABEL: Record<string, string> = {
  soja: 'Soja',
  milho: 'Milho',
  trigo: 'Trigo',
  sorgo: 'Sorgo',
  aveia: 'Aveia',
  arroz: 'Arroz',
  algodao: 'Algodão',
  cafe: 'Café',
}

const inputCls =
  'w-full px-3 py-2 rounded-md text-sm bg-white/5 border border-white/10 focus:border-accent focus:outline-none'

export function MarginsCard({ rules, precoRefSoja }: Props) {
  const [editing, setEditing] = useState<MarginRule | null>(null)
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSeed = () => {
    startTransition(async () => {
      try {
        const r = await applySeedMargins()
        setFeedback(
          r.inserted > 0
            ? `${r.inserted} margens padrão da indústria criadas.`
            : 'Já existem margens cadastradas. Edite-as ou apague antes de aplicar o seed.'
        )
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      }
    })
  }

  const handleDelete = (commodity: string) => {
    if (!confirm(`Remover margem de ${COMMODITY_LABEL[commodity] ?? commodity}?`)) return
    startTransition(async () => {
      try {
        await removeMargin(commodity)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs opacity-70">
          Defina a margem comercial esperada para cada commodity. Toda proposta nova
          herdará esse valor automaticamente — pode ser editado caso a caso na própria proposta.
        </p>
        {rules.length === 0 && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={pending}
            className="btn"
            style={{ fontSize: 12 }}
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Aplicar margens padrão (Soja 0,3% · Milho 0,4% · Trigo 0,5%)
          </button>
        )}
      </div>

      {/* Lista */}
      <ul className="space-y-2">
        {rules.length === 0 && (
          <li className="text-sm opacity-70 py-3 text-center">
            Nenhuma margem cadastrada. Use o botão acima para aplicar padrões da indústria
            ou <button type="button" onClick={() => setAdding(true)} className="underline">adicione uma manualmente</button>.
          </li>
        )}
        {rules.map((r) => {
          const calc =
            precoRefSoja && r.commodity === 'soja'
              ? calcularMargem({ margemPercent: r.margemPercent, precoBrl: precoRefSoja, unidade: 'sc60' })
              : null
          return (
            <li
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold">{COMMODITY_LABEL[r.commodity] ?? r.commodity}</span>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      fontFamily: 'var(--f-sans)',
                    }}
                  >
                    {r.margemPercent.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')}%
                  </span>
                  {r.margemMinima != null && (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      mín {r.margemMinima.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')}%
                    </span>
                  )}
                  {!r.ativa && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'var(--surface-3)',
                        color: 'var(--text-mute)',
                      }}
                    >
                      Inativa
                    </span>
                  )}
                </div>
                {calc && (
                  <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
                    Exemplo: a R$ {precoRefSoja!.toFixed(2).replace('.', ',')}/sc →{' '}
                    <strong style={{ color: 'var(--text)' }}>
                      R$ {calc.margemPorSc.toFixed(2).replace('.', ',')}/sc
                    </strong>{' '}
                    = <strong style={{ color: 'var(--text)' }}>
                      R$ {calc.margemPorTon.toFixed(2).replace('.', ',')}/t
                    </strong>
                  </div>
                )}
                {r.observacoes && (
                  <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {r.observacoes}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="btn ghost"
                style={{ fontSize: 11, padding: '6px 10px' }}
              >
                <Edit2 className="w-3 h-3" /> Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r.commodity)}
                className="btn ghost"
                style={{ fontSize: 11, padding: '6px 10px', color: 'var(--danger)' }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn primary"
          style={{ fontSize: 12 }}
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar margem
        </button>
      </div>

      {feedback && (
        <div
          className="mt-2 text-xs"
          style={{ color: 'var(--text-mute)' }}
        >
          {feedback}
        </div>
      )}

      {(editing || adding) && (
        <MarginEditorModal
          rule={editing}
          existing={rules.map((r) => r.commodity)}
          onClose={() => {
            setEditing(null)
            setAdding(false)
          }}
        />
      )}
    </>
  )
}

function MarginEditorModal({
  rule,
  existing,
  onClose,
}: {
  rule: MarginRule | null
  existing: string[]
  onClose: () => void
}) {
  const [commodity, setCommodity] = useState(rule?.commodity ?? '')
  const [margemPercent, setMargemPercent] = useState(rule?.margemPercent ?? 0.3)
  const [margemMinima, setMargemMinima] = useState<number | null>(rule?.margemMinima ?? null)
  const [observacoes, setObservacoes] = useState(rule?.observacoes ?? '')
  const [ativa, setAtiva] = useState(rule?.ativa ?? true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isEditing = !!rule
  const availableCommodities = isEditing
    ? SUPPORTED_COMMODITIES
    : SUPPORTED_COMMODITIES.filter((c) => !existing.includes(c))

  const handleSave = async () => {
    setBusy(true)
    setErr(null)
    try {
      if (!commodity) throw new Error('Selecione uma commodity')
      await saveMargin({
        commodity,
        margemPercent,
        margemMinima,
        observacoes: observacoes.trim() || null,
        ativa,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {isEditing ? `Editar margem · ${rule?.commodity}` : 'Nova margem'}
          </h3>
        </header>

        <div className="p-5 space-y-3">
          <div>
            <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
              Commodity
            </label>
            {isEditing ? (
              <input data-phb-input className={inputCls} value={commodity} disabled />
            ) : (
              <select
                data-phb-input
                className={inputCls}
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
              >
                <option value="">Selecione…</option>
                {availableCommodities.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                Margem alvo (%)
              </label>
              <input
                data-phb-input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={margemPercent}
                onChange={(e) => setMargemPercent(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                Margem mínima (%)
              </label>
              <input
                data-phb-input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={margemMinima ?? ''}
                onChange={(e) =>
                  setMargemMinima(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="opcional"
              />
            </div>
          </div>

          <div>
            <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
              Observações (opcional)
            </label>
            <textarea
              className={inputCls}
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: 'Abaixo da mínima requer aprovação do diretor.'"
              maxLength={500}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativa}
              onChange={(e) => setAtiva(e.target.checked)}
            />
            Regra ativa (aplicada em propostas novas)
          </label>

          {err && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </div>

        <footer
          className="px-5 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn ghost"
            style={{ fontSize: 12 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !commodity}
            className="btn primary"
            style={{ fontSize: 12 }}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </footer>
      </div>
    </div>
  )
}
