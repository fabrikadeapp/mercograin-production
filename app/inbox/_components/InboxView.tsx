'use client'

/**
 * Inbox unificado (F2-01). Lista conversas de todos os canais, filtra, e
 * permite converter conversa "pronta para proposta" em Oferta estruturada
 * (via /api/inbox/[id]/criar-oferta, que usa a extração de IA).
 */
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, Skeleton, EmptyState, Chip } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Inbox, MessageCircle, Mail, Globe, Sparkles, ArrowRight } from 'lucide-react'

type Channel = 'all' | 'whatsapp' | 'email' | 'instagram' | 'portal'
interface Conv {
  id: string; source: string; channel: string; clienteId: string | null
  contactName: string | null; contactHandle: string | null
  lastMessageAt: string | null; lastMessageText: string | null
  unreadCount: number; aiStatus: string; silenced: boolean
}

const CHANNEL_ICON: Record<string, any> = { whatsapp: MessageCircle, email: Mail, portal: Globe, instagram: Globe }
const CHANNEL_COLOR: Record<string, string> = { whatsapp: '#25D366', email: 'var(--info)', portal: 'var(--accent-2)', instagram: '#E1306C' }
const AI_LABEL: Record<string, { l: string; v: 'pos' | 'warn' | 'info' | 'neutral' | 'neg' }> = {
  pronta_para_proposta: { l: 'Pronta p/ proposta', v: 'pos' },
  classificado: { l: 'Classificada', v: 'info' },
  pendente_info: { l: 'Faltam dados', v: 'warn' },
  aguardando: { l: 'Aguardando', v: 'neutral' },
  nao_comercial: { l: 'Não comercial', v: 'neutral' },
  erro_leitura: { l: 'Erro leitura', v: 'neg' },
  lida: { l: 'Lida', v: 'neutral' },
}

export function InboxView() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/inbox?channel=${channel}&limit=100`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setConvs(d.conversations ?? []))
      .catch(() => toast.error('Falha ao carregar inbox'))
      .finally(() => setLoading(false))
  }, [channel, toast])
  useEffect(() => { load() }, [load])

  async function criarOferta(c: Conv) {
    setBusy(c.id)
    try {
      const res = await fetch(`/api/inbox/${c.id}/criar-oferta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 422) { toast.error(data.error || 'Revise os dados — sem cultura identificada'); return }
      if (!res.ok) throw new Error(data.error || 'Falha')
      toast.success(`Oferta ${data.oferta?.numero ?? ''} criada a partir da conversa`)
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível criar a oferta')
    } finally { setBusy(null) }
  }

  const FILTERS: Channel[] = ['all', 'whatsapp', 'email', 'portal']

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {FILTERS.map((c) => (
          <button key={c} onClick={() => setChannel(c)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${channel === c ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--text-mute)] hover:text-[var(--text)]'}`}>
            {c === 'all' ? 'Todos' : c}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        ) : convs.length === 0 ? (
          <EmptyState icon={Inbox} title="Inbox vazio" description="Conversas de WhatsApp, e-mail e portal aparecem aqui." />
        ) : convs.map((c) => {
          const Icon = CHANNEL_ICON[c.channel] ?? MessageCircle
          const ai = AI_LABEL[c.aiStatus] ?? AI_LABEL.aguardando
          const podeCriar = c.source === 'conversation' && c.aiStatus === 'pronta_para_proposta'
          return (
            <div key={c.id} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0 hover:bg-[var(--row-hover)]">
              <div className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${CHANNEL_COLOR[c.channel]} 16%, transparent)`, color: CHANNEL_COLOR[c.channel] }}>
                <Icon size={16} />
                {c.unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">{c.unreadCount}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-[var(--text)]">{c.contactName || c.contactHandle || 'Contato'}</span>
                  <Chip variant={ai.v}>{ai.l}</Chip>
                  {c.silenced && <span className="font-mono text-[9px] uppercase text-[var(--text-dim)]">silenciada</span>}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-[var(--text-mute)]">{c.lastMessageText || '—'}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <span className="font-mono text-[10.5px] text-[var(--text-dim)]">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString('pt-BR') : ''}</span>
                {podeCriar && (
                  <button onClick={() => criarOferta(c)} disabled={busy === c.id} className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--accent)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-ink)] disabled:opacity-50">
                    <Sparkles size={13} /> {busy === c.id ? 'Criando…' : 'Virar oferta'}
                  </button>
                )}
                {c.clienteId && <Link href={`/clientes/${c.clienteId}`} className="text-[var(--text-mute)] hover:text-[var(--text)]"><ArrowRight size={15} /></Link>}
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
