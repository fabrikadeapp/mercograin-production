'use client'

import Link from 'next/link'
import { ArrowUpRight, Plus } from 'lucide-react'
import { GlassCard, Avatar, Badge, Skeleton, ErrorState, EmptyState, useJson } from './_shared'

interface ClienteRadar {
  id: string
  nome: string
  cidade: string | null
  uf: string | null
  iniciais: string
  status: 'ativo' | 'lead' | 'novo' | 'inativo'
  tag: 'quente' | 'recorrente' | 'em_risco' | 'novo_lead' | 'sem_resposta' | 'follow_up_pendente' | null
  propostasAbertas: number
}

const tagLabel: Record<string, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  quente: { label: 'Quente', tone: 'success' },
  recorrente: { label: 'Recorrente', tone: 'info' },
  em_risco: { label: 'Em risco', tone: 'danger' },
  novo_lead: { label: 'Novo lead', tone: 'info' },
  sem_resposta: { label: 'Sem resposta', tone: 'warn' },
  follow_up_pendente: { label: 'Follow-up pendente', tone: 'warn' },
}

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  lead: 'Lead',
  novo: 'Novo',
  inativo: 'Inativo',
}

export function ClientesCard() {
  const { data, error, loading } = useJson<{ clientes: ClienteRadar[] }>('/api/bhgrain/clientes-radar?limit=5')

  return (
    <GlassCard
      title="Clientes"
      subtitle="Base gerencial"
      action={
        <Link href="/clientes" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
          Ver todos <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Não foi possível carregar clientes" />
      ) : !data || data.clientes.length === 0 ? (
        <EmptyState
          message="Nenhum cliente cadastrado"
          action={
            <Link href="/clientes/novo" className="text-[11px] text-vg-accent hover:underline">
              + Cadastrar primeiro cliente
            </Link>
          }
        />
      ) : (
        <ul className="space-y-1.5">
          {data.clientes.map((c) => {
            const tag = c.tag ? tagLabel[c.tag] : null
            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition"
                >
                  <Avatar initials={c.iniciais} hot={c.tag === 'quente'} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{c.nome}</div>
                    <div className="text-[11px] text-vg-fg-3 truncate">
                      {c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade ?? '—'}
                      <span className="mx-1">·</span>
                      {statusLabel[c.status]}
                    </div>
                  </div>
                  {tag && <Badge tone={tag.tone} label={tag.label} />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <footer className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--vg-border-subtle)' }}>
        <Link
          href="/clientes/novo"
          className="text-[12px] text-vg-fg-2 hover:text-vg-fg-primary flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Novo cliente
        </Link>
      </footer>
    </GlassCard>
  )
}
