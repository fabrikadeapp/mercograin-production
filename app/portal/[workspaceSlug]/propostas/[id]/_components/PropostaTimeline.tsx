'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  FilePlus,
  PenTool,
  Circle,
} from 'lucide-react'

interface TimelineEvent {
  id: string
  tipo: 'criacao' | 'envio' | 'abertura' | 'aceite' | 'recusa' | 'contrato' | 'assinatura' | 'outro'
  label: string
  detalhe?: string
  em: string
}

const ICONS: Record<TimelineEvent['tipo'], React.ComponentType<{ className?: string }>> = {
  criacao: FileText,
  envio: Send,
  abertura: Eye,
  aceite: CheckCircle2,
  recusa: XCircle,
  contrato: FilePlus,
  assinatura: PenTool,
  outro: Circle,
}

const CORES: Record<TimelineEvent['tipo'], string> = {
  criacao: '#6B7280',
  envio: '#3B82F6',
  abertura: '#0EA5E9',
  aceite: '#10B981',
  recusa: '#EF4444',
  contrato: '#8B5CF6',
  assinatura: '#16A34A',
  outro: '#9CA3AF',
}

interface Props {
  propostaId: string
}

export function PropostaTimeline({ propostaId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/portal/propostas/${propostaId}/timeline`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.events)) setEvents(j.events as TimelineEvent[])
      })
      .finally(() => setLoading(false))
  }, [propostaId])

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <p className="mt-2 text-sm text-gray-500">Carregando…</p>
      </section>
    )
  }

  if (!events || events.length === 0) {
    return null
  }

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Histórico desta proposta</h2>
      <ol className="space-y-4">
        {events.map((e, i) => {
          const Icon = ICONS[e.tipo]
          const cor = CORES[e.tipo]
          const isLast = i === events.length - 1
          return (
            <li key={e.id} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: `${cor}1a`, color: cor }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {!isLast && (
                  <span
                    className="mt-1 w-px flex-1"
                    style={{ background: '#E5E7EB', minHeight: 16 }}
                  />
                )}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-sm font-medium text-gray-900">{e.label}</p>
                {e.detalhe && (
                  <p className="text-xs text-gray-600 mt-0.5">{e.detalhe}</p>
                )}
                <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                  {new Date(e.em).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
