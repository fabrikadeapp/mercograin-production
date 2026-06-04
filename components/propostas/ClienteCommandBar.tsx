'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, UserPlus, CheckCircle2, Search } from 'lucide-react'
import { Card } from '@/components/ui/phb'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { ClienteQuickCreateModal } from '@/components/clientes/ClienteQuickCreateModal'
import type { ClienteCriado } from '@/components/clientes/ClienteForm'

interface Cliente {
  id: string
  nome: string
}

export interface ClienteCommandBarProps {
  clientes: Cliente[]
  /** Disparado quando operador escolhe (existente ou recém-criado). */
  onSelected: (cliente: Cliente) => void
  /** Callback opcional quando cliente novo é criado — atualiza lista local. */
  onClienteCriado?: (cliente: ClienteCriado) => void
}

/**
 * Etapa 1 do fluxo de criação de proposta.
 *
 * Input com busca em tempo real (fuzzy), dropdown de matches.
 * Enter no match selecionado → onSelected.
 * Enter sem match → abre modal de criar cliente.
 * Tab também abre modal (atalho explícito).
 * Mic ativa voz se suportado.
 */
export function ClienteCommandBar({
  clientes,
  onSelected,
  onClienteCriado,
}: ClienteCommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [modalAberto, setModalAberto] = useState(false)
  const speech = useSpeechRecognition({
    onTranscript: (full) => setTexto(full),
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Busca: substring case-insensitive + ordenação por prefixo de palavra
  const matches = useMemo(() => {
    const q = texto.trim().toLowerCase()
    if (!q || q.length < 2) return []
    const candidatos = clientes
      .map((c) => ({
        cliente: c,
        score: matchScore(q, c.nome.toLowerCase()),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
    return candidatos
  }, [texto, clientes])

  // Reset highlight quando matches mudam
  useEffect(() => {
    setHighlightIdx(0)
  }, [texto])

  const toggleMic = () => {
    if (!speech.supported) return
    if (speech.listening) {
      speech.stop()
    } else {
      speech.reset()
      setTexto('')
      speech.start()
    }
  }

  const escolher = (cliente: Cliente) => {
    onSelected(cliente)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((idx) => Math.min(matches.length - 1, idx + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((idx) => Math.max(0, idx - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (matches.length > 0 && matches[highlightIdx]) {
        escolher(matches[highlightIdx].cliente)
      } else if (texto.trim().length >= 2) {
        // Sem matches: abre modal de criar
        setModalAberto(true)
      }
      return
    }
    if (e.key === 'Tab' && texto.trim().length >= 2) {
      e.preventDefault()
      setModalAberto(true)
      return
    }
    if (e.key === 'Escape') {
      setTexto('')
      return
    }
  }

  const semMatches = texto.trim().length >= 2 && matches.length === 0

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-accent" />
          <p className="eyebrow">Cliente</p>
          <span className="text-fg-3 text-[11px] ml-2">
            Digite o nome para buscar ou criar novo
          </span>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Fazenda Rei do Gado"
            className="w-full px-4 py-3 pr-12 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3"
            style={{ fontFamily: 'var(--f-sans)', fontSize: 15 }}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {speech.supported && (
              <button
                type="button"
                onClick={toggleMic}
                title={speech.listening ? 'Parar de ouvir' : 'Ditar nome do cliente'}
                className={speech.listening ? 'chip active' : 'chip'}
                style={{ padding: '6px 8px' }}
              >
                {speech.listening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {speech.listening && (
          <p
            className="text-[11px] flex items-center gap-1.5"
            style={{ color: 'var(--accent)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Ouvindo… diga o nome do cliente em PT-BR.
          </p>
        )}

        {/* Dropdown de matches */}
        {matches.length > 0 && (
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
            }}
          >
            {matches.map((m, i) => (
              <button
                key={m.cliente.id}
                type="button"
                onClick={() => escolher(m.cliente)}
                onMouseEnter={() => setHighlightIdx(i)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-small transition-colors"
                style={{
                  background:
                    i === highlightIdx ? 'var(--accent-soft)' : 'transparent',
                  borderBottom:
                    i < matches.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className="flex items-center gap-2">
                  {i === highlightIdx && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                  )}
                  <span className="text-fg-1 font-medium">{m.cliente.nome}</span>
                </span>
                <span className="text-fg-3 text-[10px]">
                  {i === highlightIdx ? 'Enter' : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {semMatches && (
          <div
            className="rounded-md p-3 flex items-center justify-between gap-3"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid rgba(200,240,81,0.3)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserPlus className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <p className="text-fg-1 text-small font-medium truncate">
                  Criar cliente “{texto.trim()}”
                </p>
                <p className="text-fg-3 text-[11px]">
                  CNPJ + dados auto-preenchidos via BrasilAPI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="chip"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                fontWeight: 600,
                padding: '4px 12px',
                fontSize: 12,
                whiteSpace: 'nowrap',
              }}
            >
              Criar
            </button>
          </div>
        )}

        <div
          className="flex items-center gap-3 text-[11px] flex-wrap"
          style={{ color: 'var(--text-dim)' }}
        >
          <span>
            <kbd className="kbd">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="kbd">Enter</kbd>{' '}
            {matches.length > 0 ? 'selecionar' : 'criar cliente'}
          </span>
          <span>
            <kbd className="kbd">Tab</kbd> criar cliente
          </span>
          <span>
            <kbd className="kbd">Esc</kbd> limpar
          </span>
        </div>
      </Card>

      <ClienteQuickCreateModal
        open={modalAberto}
        onClose={() => {
          setModalAberto(false)
          inputRef.current?.focus()
        }}
        initialNome={texto.trim()}
        onCreated={(cliente) => {
          onClienteCriado?.(cliente)
          // Já avança para etapa 2 com o cliente recém-criado
          onSelected({ id: cliente.id, nome: cliente.nome })
        }}
      />
    </>
  )
}

/**
 * Score de match: 1.0 substring no início, 0.9 substring no meio,
 * 0.7 todas as palavras digitadas têm prefixo em alguma palavra do nome,
 * 0.5 ao menos uma palavra em comum.
 */
function matchScore(q: string, nome: string): number {
  if (!q || !nome) return 0
  if (nome.startsWith(q)) return 1
  if (nome.includes(q)) return 0.9
  const palavrasQ = q.split(/\s+/).filter(Boolean)
  const palavrasN = nome.split(/\s+/).filter(Boolean)
  const todasPrefixo = palavrasQ.every((p) =>
    palavrasN.some((n) => n.startsWith(p))
  )
  if (todasPrefixo) return 0.7
  const algumaComum = palavrasQ.some((p) =>
    palavrasN.some((n) => n.includes(p) || p.includes(n))
  )
  return algumaComum ? 0.5 : 0
}
