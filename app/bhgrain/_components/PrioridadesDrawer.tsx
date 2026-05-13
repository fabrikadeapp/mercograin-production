'use client'

import { Drawer } from './Drawer'
import { Skeleton, ErrorState, EmptyState, Badge, useJson } from './_shared'
import { Sparkles } from 'lucide-react'

interface Prioridade {
  propostaId: string
  tipo: string
  prioridade: 'alta' | 'media' | 'baixa'
  titulo: string
  motivo: string
  acaoSugerida: string
}

const tipoLabel: Record<string, string> = {
  cotacao_vencida: 'Cotação vencida',
  cotacao_vencendo: 'Cotação vencendo',
  margem_baixa: 'Margem baixa',
  alto_score_sem_envio: 'Alto score · pronta',
  alto_valor_sem_resposta: 'Alto valor · sem resposta',
  follow_up: 'Follow-up',
}

const prioridadeTone: Record<string, 'danger' | 'warn' | 'info'> = {
  alta: 'danger',
  media: 'warn',
  baixa: 'info',
}

export function PrioridadesDrawer({
  open,
  onClose,
  onOpenProposta,
}: {
  open: boolean
  onClose: () => void
  onOpenProposta: (id: string) => void
}) {
  const { data, error, loading } = useJson<{ prioridades: Prioridade[] }>(
    open ? '/api/bhgrain/prioridades?limit=10' : null,
    [open]
  )

  return (
    <Drawer open={open} onClose={onClose} title="O que fazer agora" subtitle="Priorização da IA · top ações comerciais" width="max-w-md">
      <div className="flex items-center gap-2 mb-3 text-[11px] text-vg-fg-3">
        <Sparkles className="w-3 h-3 text-vg-accent" />
        Sugestões baseadas em score, validade, margem e tempo sem resposta. Nenhuma ação é executada automaticamente.
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar prioridades" />
      ) : !data || data.prioridades.length === 0 ? (
        <EmptyState message="Nenhuma ação prioritária no momento" />
      ) : (
        <ol className="space-y-2">
          {data.prioridades.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => onOpenProposta(p.propostaId)}
                className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition border"
                style={{ borderColor: 'var(--vg-border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    <span className="text-vg-fg-3 tabular-nums">{i + 1}.</span>
                    {p.titulo}
                  </div>
                  <Badge tone={prioridadeTone[p.prioridade]} label={tipoLabel[p.tipo] ?? p.tipo} />
                </div>
                <div className="text-[12px] text-vg-fg-2 mb-1">{p.motivo}</div>
                <div className="text-[11px] text-vg-fg-3">
                  Sugestão: <span className="text-vg-fg-2">{p.acaoSugerida}</span>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}
