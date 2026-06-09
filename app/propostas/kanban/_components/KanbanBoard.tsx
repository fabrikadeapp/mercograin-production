'use client'

/**
 * KanbanBoard — quadro full-screen de propostas por etapa.
 *
 * Colunas mapeiam para Proposta.status (lib/propostas/status.ts). Arrastar um
 * card chama PATCH /api/propostas/[id]/status — a transição é validada no
 * servidor (transicoes.ts); se inválida, faz rollback otimista + toast.
 *
 * "Recusada/perdida" exige lossReason → drop é bloqueado e o usuário é
 * direcionado a abrir a proposta para informar o motivo.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/contexts/ToastContext'
import { Skeleton, Dialog, Button } from '@/components/ui/phb'
import { ChevronLeft, Plus, Send, Mail, MessageCircle, AlertTriangle } from 'lucide-react'

interface GraoItem { grao?: string; commodity?: string; quantidade?: number; quantidadeSc?: number }
interface Proposta {
  id: string
  numero: string
  status: string
  valorTotal: string
  validadeEm?: string
  criadaEm: string
  enviadaEm?: string | null
  cliente?: { nome?: string; email?: string | null; whatsapp?: string | null }
  graos?: unknown
}

/** Colunas do quadro. `target` = status canônico que o card assume ao ser
 *  solto NAQUELA coluna. A validação real fica no servidor (transicoes.ts);
 *  o quadro só propõe a transição. */
const COLS = [
  { key: 'rascunho', label: 'Rascunho', color: 'var(--text-dim)', match: (s: string) => /rascunho|pendente|pronta|aguardando/.test(s), target: 'rascunho' },
  { key: 'enviada', label: 'Enviada', color: 'var(--accent-2)', match: (s: string) => /^enviada$/.test(s), target: 'enviada' },
  { key: 'negociacao', label: 'Em negociação', color: 'var(--warning)', match: (s: string) => /negocia/.test(s), target: 'em_negociacao' },
  { key: 'aceita', label: 'Aceita', color: 'var(--success)', match: (s: string) => /aceita|aprovada|sucesso|fechado|concluido|faturado/.test(s), target: 'aceita' },
  { key: 'perdida', label: 'Recusada / Perdida', color: 'var(--danger)', match: (s: string) => /recusada|rejeitada|expirada|cancelad|perdida/.test(s), target: 'perdida' },
] as const

const GRAIN_COLOR: Record<string, string> = {
  soja: 'var(--grain-soja)', milho: 'var(--grain-milho)', trigo: 'var(--grain-trigo)',
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

function commodityOf(p: Proposta): { commodity: string | null; sc: number | null } {
  const arr = Array.isArray(p.graos) ? (p.graos as GraoItem[]) : []
  const sc = arr.reduce((a, g) => a + (g.quantidadeSc ?? g.quantidade ?? 0), 0)
  const c = arr[0]?.commodity ?? arr[0]?.grao ?? null
  return { commodity: c ? cap(c) : null, sc: sc > 0 ? sc : null }
}

function validadeLabel(p: Proposta): string | null {
  if (!p.validadeEm) return null
  const dias = Math.round((new Date(p.validadeEm).getTime() - Date.now()) / 86_400_000)
  if (dias < 0) return 'vencida'
  if (dias === 0) return 'expira hoje'
  if (dias <= 3) return `expira ${dias}d`
  return null
}

const COMMODITIES = ['todas', 'soja', 'milho', 'trigo'] as const

export function KanbanBoard() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<(typeof COMMODITIES)[number]>('todas')
  // Proposta aguardando confirmação de envio ao cliente (drop em "Enviada").
  const [confirmarEnvio, setConfirmarEnvio] = useState<Proposta | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/propostas?limit=200')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPropostas(d.data ?? []))
      .catch(() => toast.error('Não foi possível carregar as propostas'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filtro === 'todas') return propostas
    return propostas.filter((p) => {
      const { commodity } = commodityOf(p)
      return commodity?.toLowerCase() === filtro
    })
  }, [propostas, filtro])

  const byCol = useMemo(() => {
    const map: Record<string, Proposta[]> = {}
    for (const c of COLS) map[c.key] = []
    for (const p of filtered) {
      const col = COLS.find((c) => c.match(p.status.toLowerCase()))
      if (col) map[col.key].push(p)
    }
    return map
  }, [filtered])

  async function moveTo(p: Proposta, colKey: string) {
    const col = COLS.find((c) => c.key === colKey)
    if (!col) return
    // já está na coluna
    if (col.match(p.status.toLowerCase())) return

    // Perdida exige lossReason — não dá pra arrastar.
    if (col.target === 'perdida') {
      toast.error('Para marcar como perdida, abra a proposta e informe o motivo.')
      return
    }

    // Mover para "Enviada" sem ter enviado ao cliente ainda → confirma o envio
    // real (WhatsApp/email) em vez de só trocar o status no banco.
    if (col.target === 'enviada' && !p.enviadaEm) {
      setConfirmarEnvio(p)
      return
    }

    const anterior = p.status
    // otimista
    setPropostas((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: col.target } : x)))

    try {
      const res = await fetch(`/api/propostas/${p.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: col.target }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Transição inválida')
      }
      toast.success(`${p.numero} → ${col.label}`)
      // recarrega para refletir efeitos colaterais (enviadaEm, etc.)
      load()
    } catch (e: any) {
      // rollback
      setPropostas((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: anterior } : x)))
      toast.error(e?.message || 'Não foi possível mover a proposta')
    }
  }

  /**
   * Confirma o envio real da proposta ao cliente. Usa o endpoint de envio do
   * BH Grain, que aplica regras comerciais, muda o status p/ "enviada", marca
   * enviadaEm e dispara as notificações (WhatsApp/email). Trata os 3 desfechos:
   * permitido, aprovação pendente e bloqueado por regra.
   */
  async function executarEnvio(p: Proposta) {
    setEnviando(true)
    try {
      const res = await fetch(`/api/bhgrain/propostas/${p.id}/enviar`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.status === 202 || data?.decisao === 'aprovacao') {
        toast.info(`${p.numero} aguarda aprovação interna antes de ir ao cliente.`)
      } else if (res.status === 409 || data?.decisao === 'bloqueado') {
        const motivos = Array.isArray(data?.motivos) ? data.motivos.join(' · ') : 'Regra comercial impediu o envio.'
        toast.error(`Envio bloqueado: ${motivos}`)
      } else if (res.ok) {
        if (data?.semEmailDocumental || data?.emailEnviado === false) {
          // Enviada, mas sem o registro documental por e-mail — alerta o operador.
          toast.warning(`${p.numero} enviada, mas SEM e-mail (registro formal). Cadastre o e-mail do cliente.`)
        } else {
          toast.success(`${p.numero} enviada ao cliente por e-mail ✓`)
        }
      } else {
        throw new Error(data?.error || 'Falha no envio')
      }
      setConfirmarEnvio(null)
      load() // reflete novo status/enviadaEm
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar a proposta')
    } finally {
      setEnviando(false)
    }
  }

  const total = filtered.length

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* barra */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-1 pb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 text-[12.5px] text-[var(--text-mute)] hover:text-[var(--text)]">
          <ChevronLeft size={15} /> Dashboard
        </Link>
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">Kanban de propostas</h1>
          <p className="text-[12px] text-[var(--text-mute)]">{total} propostas · arraste os cards para mudar de etapa</p>
        </div>
        <div className="ml-4 flex gap-1.5">
          {COMMODITIES.map((c) => (
            <button key={c} onClick={() => setFiltro(c)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${filtro === c ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--text-mute)] hover:text-[var(--text)]'}`}>
              {c}
            </button>
          ))}
        </div>
        <Link href="/propostas/nova" className="ml-auto inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-ink)]">
          <Plus size={15} /> Nova proposta
        </Link>
      </div>

      {/* board */}
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto pt-4 md:grid-cols-3 xl:grid-cols-5">
        {COLS.map((col) => {
          const cards = byCol[col.key] ?? []
          const soma = cards.reduce((a, p) => a + Number(p.valorTotal || 0), 0)
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key) }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => {
                setOverCol(null)
                const p = propostas.find((x) => x.id === dragId)
                if (p) moveTo(p, col.key)
                setDragId(null)
              }}
              className={`flex min-w-[180px] flex-col rounded-[14px] border p-3 transition-colors ${overCol === col.key ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : 'border-[var(--border)] bg-[var(--bg-elev)]'}`}
            >
              <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--text)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.color }} /> {col.label}
                </span>
                <span className="font-mono text-[11px] font-bold text-[var(--text-dim)]">{cards.length}</span>
              </div>
              {soma > 0 && <div className="mb-2 font-mono text-[10px] text-[var(--text-dim)]">{brl(soma)}</div>}

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {loading ? (
                  <><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></>
                ) : cards.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-[var(--text-dim)]">—</p>
                ) : cards.map((p) => {
                  const { commodity, sc } = commodityOf(p)
                  const val = validadeLabel(p)
                  const grainColor = commodity ? GRAIN_COLOR[commodity.toLowerCase()] ?? 'var(--accent)' : 'var(--accent)'
                  return (
                    <Link
                      key={p.id}
                      href={`/propostas/${p.id}`}
                      draggable
                      onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move' }}
                      onDragEnd={() => setDragId(null)}
                      className={`group block cursor-grab rounded-[11px] border border-[var(--border)] bg-[var(--surface-1)] p-3 shadow-[var(--sh-1)] active:cursor-grabbing ${dragId === p.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text)]">{p.cliente?.nome ?? 'Cliente'}</span>
                        {commodity && <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-[6px] text-[9px] font-bold" style={{ background: grainColor, color: 'var(--accent-ink)' }}>{commodity[0]}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-[var(--text-mute)]">
                        <span>{p.numero}</span>
                        {(sc != null || commodity) && <span>{sc != null ? `${sc.toLocaleString('pt-BR')} sc` : ''}{sc != null && commodity ? ' · ' : ''}{commodity ?? ''}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
                        <span className="font-mono text-[13px] font-bold text-[var(--text)]">{Number(p.valorTotal) ? brl(Number(p.valorTotal)) : '—'}</span>
                        {val && <span className={`font-mono text-[10px] font-semibold ${val === 'vencida' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}>{val}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmação de envio ao cliente — só dispara o envio real ao confirmar */}
      {confirmarEnvio && (() => {
        const p = confirmarEnvio
        const temEmail = !!p.cliente?.email
        return (
          <Dialog
            open
            onOpenChange={(o) => { if (!o && !enviando) setConfirmarEnvio(null) }}
            title="Enviar proposta ao cliente?"
            description={`A proposta ${p.numero} ainda não foi enviada. Ao confirmar, ela será enviada para ${p.cliente?.nome ?? 'o cliente'}.`}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmarEnvio(null)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button onClick={() => executarEnvio(p)} disabled={enviando || !temEmail}>
                  <Send size={14} className="mr-1.5" />
                  {enviando ? 'Enviando…' : 'Confirmar envio'}
                </Button>
              </div>
            }
          >
            <div className="space-y-2.5 text-[13px]">
              {/* E-mail — canal documental principal (prova formal) */}
              <div className="rounded-[var(--r-sm)] border border-[var(--border)] p-2.5">
                <div className="flex items-center gap-2">
                  <Mail size={15} className={temEmail ? 'text-[var(--success)]' : 'text-[var(--danger)]'} />
                  <span className="font-medium text-[var(--text)]">E-mail</span>
                  <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">Documental</span>
                </div>
                <p className={`mt-1 ${temEmail ? 'text-[var(--text-mute)]' : 'text-[var(--danger)]'}`}>
                  {p.cliente?.email ?? 'Sem e-mail cadastrado'}
                </p>
              </div>
              {/* WhatsApp — aviso complementar */}
              <div className="flex items-center gap-2 px-1 text-[var(--text)]">
                <MessageCircle size={15} className={p.cliente?.whatsapp ? 'text-[var(--success)]' : 'text-[var(--text-dim)]'} />
                <span className={p.cliente?.whatsapp ? '' : 'text-[var(--text-dim)]'}>
                  {p.cliente?.whatsapp ? `WhatsApp (aviso): ${p.cliente.whatsapp}` : 'Sem WhatsApp — aviso complementar não sairá'}
                </span>
              </div>
              {!temEmail && (
                <div className="mt-1 flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-2.5 text-[12px] text-[var(--danger)]">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>O cliente não tem <strong>e-mail</strong>, que é o registro formal em caso de disputa. Cadastre o e-mail antes de enviar.</span>
                </div>
              )}
            </div>
          </Dialog>
        )
      })()}
    </div>
  )
}
