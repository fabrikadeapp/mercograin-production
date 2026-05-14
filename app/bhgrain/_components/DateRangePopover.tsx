'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, X } from 'lucide-react'

interface Props {
  active: boolean
  startDate: string | null
  endDate: string | null
  onApply: (start: string, end: string) => void
  onClear: () => void
}

function formatPtBR(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function shortPtBR(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Chip "Personalizar" do FilterBar. Quando ativo mostra o intervalo selecionado.
 * Abre popover com 2 inputs date e botões Aplicar/Cancelar.
 */
export function DateRangePopover({ active, startDate, endDate, onApply, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(startDate ?? '')
  const [end, setEnd] = useState(endDate ?? '')
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStart(startDate ?? '')
    setEnd(endDate ?? '')
  }, [startDate, endDate])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label =
    active && startDate && endDate
      ? `${shortPtBR(startDate)} – ${shortPtBR(endDate)}`
      : 'Personalizar'

  const canApply = start && end && start <= end

  return (
    <div ref={popRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={active ? 'chip active' : 'chip'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Calendar style={{ width: 12, height: 12 }} />
        {label}
        {active && (
          <X
            style={{ width: 11, height: 11, opacity: 0.7 }}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
              setOpen(false)
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--sh-3)',
            padding: 14,
            minWidth: 280,
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Intervalo customizado
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>De</div>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Até</div>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          {active && startDate && endDate ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
              Atual: {formatPtBR(startDate)} → {formatPtBR(endDate)}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!canApply}
              onClick={() => {
                if (canApply) {
                  onApply(start, end)
                  setOpen(false)
                }
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
