'use client'

import { useEffect, useState } from 'react'
import {
  expandirCotacao,
  formatCotacao,
  UNIDADE_LABEL,
  UNIDADE_LABEL_FULL,
  KG_POR_BU,
  KG_POR_SC,
  type Grao,
  type Unidade,
} from '@/lib/cotacoes/unidades'

interface Props {
  grao: Grao
  /** Unidade em que o valor de entrada está expresso. Default 'brlSc60'. */
  unidadeEntrada?: Unidade
  /** Valor numérico na unidade de entrada (null = sem dado). */
  valor: number | null
  /** Câmbio USD/BRL (para converter US$/bu ↔ R$). Necessário para usdBu. */
  usdbrl?: number | null
  /** Unidade exibida. Default = preferência do usuário (localStorage). */
  unidadeExibida?: Unidade
  /** Mostrar sufixo "/sc" "/t" "/bu" "/kg" inline. Default true. */
  showSuffix?: boolean
  /** Texto contextual da fonte (ex.: 'CEPEA · ESALQ'). Aparece no tooltip. */
  fonte?: string
  /** Texto adicional pro tooltip (ex.: vencimento, timestamp). */
  contexto?: string
  /** Tamanho visual. */
  size?: 'sm' | 'md' | 'lg'
  /** Cor especial (ex.: lime accent para Valor Total). */
  accent?: boolean
  className?: string
}

const SIZE_STYLES: Record<NonNullable<Props['size']>, { fontSize: number; weight: number; sufFontSize: number }> = {
  sm: { fontSize: 12, weight: 500, sufFontSize: 10 },
  md: { fontSize: 14, weight: 600, sufFontSize: 11 },
  lg: { fontSize: 20, weight: 600, sufFontSize: 12 },
}

/**
 * Renderiza UMA cotação com unidade explícita sempre visível + tooltip
 * com todas as conversões equivalentes.
 *
 * Garante consistência: nenhum preço fica sem unidade no produto.
 */
export function Cotacao({
  grao,
  unidadeEntrada = 'brlSc60',
  valor,
  usdbrl,
  unidadeExibida,
  showSuffix = true,
  fonte,
  contexto,
  size = 'md',
  accent = false,
  className,
}: Props) {
  // Resolve unidade exibida no mount (evita SSR/CSR mismatch ao ler localStorage)
  const [resolved, setResolved] = useState<Unidade>(unidadeExibida ?? 'brlSc60')
  useEffect(() => {
    if (unidadeExibida) {
      setResolved(unidadeExibida)
      return
    }
    const readStored = () => {
      try {
        const stored = window.localStorage.getItem('bhg-unidade')
        if (
          stored === 'brlSc60' ||
          stored === 'brlTon' ||
          stored === 'usdBu' ||
          stored === 'brlKg'
        ) {
          setResolved(stored)
        }
      } catch {
        /* ignore */
      }
    }
    readStored()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bhg-unidade') readStored()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [unidadeExibida])

  // Expandir cotação para todas as unidades
  const conv =
    valor != null
      ? expandirCotacao({ grao, unidade: unidadeEntrada, valor, usdbrl })
      : null

  // Valor na unidade pedida
  const valorExibido =
    conv == null
      ? null
      : resolved === 'brlSc60'
        ? conv.brlSc60
        : resolved === 'brlTon'
          ? conv.brlTon
          : resolved === 'usdBu'
            ? conv.usdBu
            : conv.brlKg

  const formatted = formatCotacao(valorExibido, resolved, { showSuffix })
  const style = SIZE_STYLES[size]

  // Tooltip: lista todas as conversões + densidade + fonte
  const tooltipParts: string[] = []
  if (fonte) tooltipParts.push(fonte)
  if (contexto) tooltipParts.push(contexto)
  if (conv) {
    const allUnits: Unidade[] = ['brlSc60', 'brlTon', 'usdBu', 'brlKg']
    for (const u of allUnits) {
      if (u === resolved) continue
      const v =
        u === 'brlSc60'
          ? conv.brlSc60
          : u === 'brlTon'
            ? conv.brlTon
            : u === 'usdBu'
              ? conv.usdBu
              : conv.brlKg
      if (v != null) {
        tooltipParts.push(`= ${formatCotacao(v, u).full}`)
      }
    }
    tooltipParts.push(
      `${KG_POR_SC[grao]} kg/saca · ${KG_POR_BU[grao].toFixed(4).replace('.', ',')} kg/bushel`
    )
  }
  const tooltip = tooltipParts.join('\n')

  return (
    <span
      className={className}
      title={tooltip}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}
    >
      <span
        className="tabular-nums"
        style={{
          fontSize: style.fontSize,
          fontWeight: style.weight,
          color: accent ? 'var(--accent)' : 'var(--text)',
          fontFamily: 'var(--f-sans)',
          fontFeatureSettings: '"tnum", "ss01"',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatted.valor}
      </span>
      {showSuffix && formatted.valor !== '—' && (
        <span
          style={{
            fontSize: style.sufFontSize,
            color: 'var(--text-mute)',
            fontFamily: 'var(--f-mono)',
            letterSpacing: '0.02em',
          }}
          aria-label={UNIDADE_LABEL_FULL[resolved]}
        >
          {formatted.sufixo}
        </span>
      )}
    </span>
  )
}

/**
 * Pequeno seletor de unidade (4 chips) que persiste em localStorage
 * 'bhg-unidade'. Use no topo de cards/páginas que mostram cotações.
 *
 * Dispara evento 'storage' (cross-tab) e re-render via state local.
 */
export function UnidadeSelector({
  value,
  onChange,
  className,
}: {
  value?: Unidade
  onChange?: (u: Unidade) => void
  className?: string
}) {
  const [internal, setInternal] = useState<Unidade>(value ?? 'brlSc60')

  useEffect(() => {
    if (value) {
      setInternal(value)
      return
    }
    const readStored = () => {
      try {
        const stored = window.localStorage.getItem('bhg-unidade')
        if (
          stored === 'brlSc60' ||
          stored === 'brlTon' ||
          stored === 'usdBu' ||
          stored === 'brlKg'
        ) {
          setInternal(stored)
        }
      } catch {
        /* ignore */
      }
    }
    readStored()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bhg-unidade') readStored()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [value])

  const apply = (u: Unidade) => {
    setInternal(u)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('bhg-unidade', u)
        // Dispara evento sintético para outros componentes Cotacao re-lerem
        window.dispatchEvent(new StorageEvent('storage', { key: 'bhg-unidade', newValue: u }))
      }
    } catch {
      /* ignore */
    }
    onChange?.(u)
  }

  return (
    <div className={className} style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {(['brlSc60', 'brlTon', 'usdBu', 'brlKg'] as Unidade[]).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => apply(u)}
          title={UNIDADE_LABEL_FULL[u]}
          className={internal === u ? 'chip active' : 'chip'}
          style={{ fontSize: 11, padding: '4px 10px' }}
        >
          {UNIDADE_LABEL[u]}
        </button>
      ))}
    </div>
  )
}

/** Footer padrão com notas de unidade — use em cards de preço. */
export function CotacoesFooterNote() {
  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--text-dim)',
        fontFamily: 'var(--f-mono)',
        letterSpacing: '0.02em',
        lineHeight: 1.5,
      }}
    >
      Saca = 60 kg salvo indicação · Tonelada = 1.000 kg · Bushel USDA: soja/trigo 27,22 kg ·
      milho 25,40 kg · Conversão R$ ↔ US$ usa câmbio do card
    </div>
  )
}
