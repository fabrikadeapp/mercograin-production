'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Drawer } from './Drawer'
import { Skeleton, ErrorState, EmptyState, Badge, useJson } from './_shared'

interface UnifiedMessage {
  id: string
  conversationId: string
  channel: 'whatsapp' | 'email' | 'instagram' | 'portal'
  direction: 'in' | 'out'
  text: string | null
  occurredAt: string
  aiExtraction: unknown | null
  aiScore: number | null
}

interface UnifiedConversation {
  id: string
  channel: 'whatsapp' | 'email' | 'instagram' | 'portal'
  clienteId: string | null
  contactName: string | null
  contactHandle: string | null
  lastMessageAt: string | null
  unreadCount: number
  aiStatus: string
}

interface Resp {
  conversation: UnifiedConversation
  messages: UnifiedMessage[]
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  portal: 'Portal',
}

const AI_STATUS_LABEL: Record<string, { label: string; tone: 'info' | 'success' | 'warn' | 'danger' | 'neutral' }> = {
  aguardando: { label: 'Aguardando leitura', tone: 'warn' },
  lida: { label: 'Lida pela IA', tone: 'info' },
  classificado: { label: 'Classificado', tone: 'info' },
  pronta_para_proposta: { label: 'Pronta para proposta', tone: 'success' },
  pendente_info: { label: 'Pendente de informação', tone: 'warn' },
  nao_comercial: { label: 'Não comercial', tone: 'neutral' },
  erro_leitura: { label: 'Erro de leitura', tone: 'danger' },
}

interface AiExtraction {
  commodity?: string
  quantidade?: number
  unidade?: string
  intencao?: string
  dadosFaltantes?: string[]
  confianca?: number
}

export function ConversaDrawer({
  conversationId,
  onClose,
}: {
  conversationId: string | null
  onClose: () => void
}) {
  const { data, error, loading } = useJson<Resp>(
    conversationId ? `/api/inbox/${encodeURIComponent(conversationId)}/messages?limit=50` : null,
    [conversationId]
  )

  const conv = data?.conversation
  const status = conv?.aiStatus ? AI_STATUS_LABEL[conv.aiStatus] ?? AI_STATUS_LABEL.aguardando : null

  return (
    <Drawer
      open={conversationId !== null}
      onClose={onClose}
      title={conv?.contactName ?? 'Conversa'}
      subtitle={conv ? `${CHANNEL_LABEL[conv.channel] ?? conv.channel}${conv.contactHandle ? ` · ${conv.contactHandle}` : ''}` : undefined}
      width="max-w-xl"
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar mensagens" />
      ) : !data || data.messages.length === 0 ? (
        <EmptyState message="Sem mensagens nesta conversa" />
      ) : (
        <div className="space-y-3">
          {status && (
            <div className="flex items-center gap-2 text-[11px] text-vg-fg-3">
              <span>Status IA:</span>
              <Badge tone={status.tone} label={status.label} />
            </div>
          )}

          <ul className="space-y-2">
            {data.messages
              .slice()
              .reverse()
              .map((m) => {
                const extraction = (m.aiExtraction ?? null) as AiExtraction | null
                const isOut = m.direction === 'out'
                return (
                  <li
                    key={m.id}
                    className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-[12px] ${
                        isOut ? '' : ''
                      }`}
                      style={{
                        background: isOut ? 'var(--vg-accent-primary, #3b82f6)' : 'var(--vg-glass-card-hover, rgba(255,255,255,0.08))',
                        color: isOut ? '#fff' : 'var(--vg-fg-primary)',
                      }}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.text ?? '(sem texto)'}</div>
                      <div className="text-[10px] opacity-70 mt-1 tabular-nums">
                        {new Date(m.occurredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {extraction && (extraction.commodity || extraction.quantidade) && (
                        <div className="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-80">
                          IA detectou:
                          {extraction.commodity && <span className="ml-1">{extraction.commodity}</span>}
                          {extraction.quantidade != null && <span className="ml-1">· {extraction.quantidade} {extraction.unidade ?? ''}</span>}
                          {extraction.dadosFaltantes && extraction.dadosFaltantes.length > 0 && (
                            <div className="mt-0.5">Faltam: {extraction.dadosFaltantes.join(', ')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>

          {conv?.clienteId ? (
            <ReplyForm
              clienteId={conv.clienteId}
              channelLabel={CHANNEL_LABEL[conv.channel] ?? conv.channel}
              onSent={() => window.location.reload()}
            />
          ) : (
            <div className="mt-4 p-3 rounded border text-[11px] text-vg-fg-3" style={{ borderColor: 'var(--vg-border-subtle)' }}>
              Esta conversa não está vinculada a um cliente — responda pelo canal original.
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

function ReplyForm({
  clienteId,
  channelLabel,
  onSent,
}: {
  clienteId: string
  channelLabel: string
  onSent: () => void
}) {
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setBusy(true)
    setErro(null)
    setOk(false)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error ?? 'erro')
        return
      }
      setTexto('')
      setOk(true)
      setTimeout(onSent, 800)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <div className="text-mini text-fg-2">
        Responder via portal · também notifica por email + WhatsApp ({channelLabel})
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Digite sua resposta…"
        rows={3}
        className="w-full rounded border border-border-1 bg-bg-1 p-2 text-small text-fg-1"
      />
      {erro && <div className="text-mini text-neg">Erro: {erro}</div>}
      {ok && <div className="text-mini text-pos">Mensagem enviada (portal + email + WhatsApp).</div>}
      <button
        type="submit"
        disabled={busy || !texto.trim()}
        className="inline-flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 text-small font-medium text-bg-0 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Enviar
      </button>
    </form>
  )
}
