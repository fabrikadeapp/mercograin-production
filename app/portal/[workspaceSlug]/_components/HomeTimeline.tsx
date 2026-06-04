'use client'

import { useMemo, useState } from 'react'
import { FileText, Wallet, MessageSquare, CheckCircle2 } from 'lucide-react'

export interface TimelineEvent {
  id: string
  tipo: 'contrato' | 'boleto' | 'mensagem'
  when: string
  kind: 'ok' | 'warn' | 'danger' | 'info'
  title: string
  actions?: Array<{ label: string; href: string; primary?: boolean }>
}

type Filtro = 'tudo' | 'contrato' | 'boleto' | 'mensagem'

function relativo(when: string): string {
  const d = new Date(when)
  const diff = Date.now() - d.getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const dias = Math.round(h / 24)
  if (dias < 30) return `há ${dias} d`
  return d.toLocaleDateString('pt-BR')
}

export function HomeTimeline({ events }: { events: TimelineEvent[] }) {
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const filtrados = useMemo(
    () => (filtro === 'tudo' ? events : events.filter((e) => e.tipo === filtro)),
    [events, filtro],
  )

  return (
    <section className="portal-timeline">
      <div className="filter">
        {(['tudo', 'contrato', 'boleto', 'mensagem'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={'chip' + (filtro === f ? ' active' : '')}
          >
            {labelFiltro(f)}
          </button>
        ))}
      </div>
      {filtrados.length === 0 && (
        <div className="portal-empty">Nada por aqui ainda.</div>
      )}
      {filtrados.map((e) => (
        <article key={e.id} className={'event ' + e.kind}>
          <div className="dot" />
          <div style={{ flex: 1 }}>
            <div className="when">{relativo(e.when)}</div>
            <div className="text" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {iconFor(e)}
              <span>{e.title}</span>
            </div>
            {e.actions && e.actions.length > 0 && (
              <div className="actions">
                {e.actions.map((a) => (
                  <a
                    key={a.label}
                    href={a.href}
                    className={'portal-btn' + (a.primary ? ' primary' : '')}
                    target={a.href.startsWith('/api/') ? '_blank' : undefined}
                    rel={a.href.startsWith('/api/') ? 'noreferrer' : undefined}
                  >
                    {a.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function labelFiltro(f: Filtro): string {
  switch (f) {
    case 'tudo':
      return 'Tudo'
    case 'contrato':
      return 'Contratos'
    case 'boleto':
      return 'Boletos'
    case 'mensagem':
      return 'Mensagens'
  }
}

function iconFor(e: TimelineEvent) {
  if (e.tipo === 'boleto') return <Wallet size={14} />
  if (e.tipo === 'mensagem') return <MessageSquare size={14} />
  if (e.kind === 'ok') return <CheckCircle2 size={14} />
  return <FileText size={14} />
}
