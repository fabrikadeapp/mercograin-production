'use client'

import { useState } from 'react'
import { Drawer } from './Drawer'

export interface FiltrosAvancados {
  scoreMin: number | null // 0..100
  statusProposta: string[] // ['rascunho', 'enviada', ...]
  valorMin: number | null
  valorMax: number | null
  scoreLabel: string[] // ['alta', 'media', ...]
  regiao: string // UF
}

export const FILTROS_VAZIO: FiltrosAvancados = {
  scoreMin: null,
  statusProposta: [],
  valorMin: null,
  valorMax: null,
  scoreLabel: [],
  regiao: '',
}

const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'rejeitada', label: 'Rejeitada' },
  { value: 'expirada', label: 'Expirada' },
]

const SCORE_LABEL_OPCOES: { value: string; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'risco', label: 'Risco' },
]

const UF_OPCOES = ['', 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

interface Props {
  open: boolean
  onClose: () => void
  initial: FiltrosAvancados
  onApply: (filtros: FiltrosAvancados) => void
}

function countAtivos(f: FiltrosAvancados): number {
  let n = 0
  if (f.scoreMin != null) n++
  if (f.statusProposta.length > 0) n++
  if (f.valorMin != null || f.valorMax != null) n++
  if (f.scoreLabel.length > 0) n++
  if (f.regiao) n++
  return n
}

export function FiltrosAvancadosDrawer({ open, onClose, initial, onApply }: Props) {
  const [f, setF] = useState<FiltrosAvancados>(initial)

  const toggleArr = (key: 'statusProposta' | 'scoreLabel', value: string) => {
    setF((prev) => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  const ativos = countAtivos(f)

  return (
    <Drawer open={open} onClose={onClose} title="Filtros avançados" subtitle={`${ativos} ${ativos === 1 ? 'filtro' : 'filtros'} aplicados`} width="max-w-md">
      <div className="space-y-5">
        {/* Score mínimo */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Score IA mínimo</div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={f.scoreMin ?? 0}
            onChange={(e) => setF({ ...f, scoreMin: Number(e.target.value) || null })}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>
            {f.scoreMin == null ? 'Sem filtro' : `≥ ${f.scoreMin} / 100`}
          </div>
        </section>

        {/* Status da proposta */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Status da proposta</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_OPCOES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleArr('statusProposta', s.value)}
                className={f.statusProposta.includes(s.value) ? 'chip active' : 'chip'}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Classificação IA */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Classificação IA</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SCORE_LABEL_OPCOES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleArr('scoreLabel', s.value)}
                className={f.scoreLabel.includes(s.value) ? 'chip active' : 'chip'}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Valor */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Faixa de valor (R$)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              type="number"
              placeholder="Mínimo"
              value={f.valorMin ?? ''}
              onChange={(e) => setF({ ...f, valorMin: e.target.value ? Number(e.target.value) : null })}
            />
            <input
              type="number"
              placeholder="Máximo"
              value={f.valorMax ?? ''}
              onChange={(e) => setF({ ...f, valorMax: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </section>

        {/* Região (UF) */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Região (UF do cliente)</div>
          <select value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} style={{ width: '100%' }}>
            {UF_OPCOES.map((uf) => (
              <option key={uf} value={uf}>{uf || 'Todas'}</option>
            ))}
          </select>
        </section>

        {/* Footer ações */}
        <footer
          className="sticky bottom-0 -mx-5 px-5 py-3 flex justify-between"
          style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}
        >
          <button
            type="button"
            className="btn ghost"
            onClick={() => setF(FILTROS_VAZIO)}
            disabled={ativos === 0}
          >
            Limpar tudo
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onApply(f)
                onClose()
              }}
            >
              Aplicar
            </button>
          </div>
        </footer>
      </div>
    </Drawer>
  )
}

export { countAtivos as countFiltrosAvancadosAtivos }
