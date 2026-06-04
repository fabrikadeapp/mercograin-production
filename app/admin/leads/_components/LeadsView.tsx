'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Lead {
  id: string
  email: string
  nomeCompleto: string | null
  telefone: string | null
  whatsapp: string | null
  cpfCnpj: string | null
  cargoEmpresa: string | null
  cidade: string | null
  uf: string | null
  status: string
  observacao: string | null
  fonte: string
  ultimoContatoEm: string | null
  createdAt: string
  origemWorkspace: { name: string; slug: string }
}

const STATUS: { key: string; label: string; cor: string }[] = [
  { key: 'novo', label: 'Novo', cor: '#1a73e8' },
  { key: 'qualificado', label: 'Qualificado', cor: '#0a8a3a' },
  { key: 'em_contato', label: 'Em contato', cor: '#f59e0b' },
  { key: 'proposta', label: 'Proposta', cor: '#a855f7' },
  { key: 'fechado', label: 'Fechado', cor: '#16a34a' },
  { key: 'descartado', label: 'Descartado', cor: '#6b7280' },
]

export function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (q) params.set('q', q)
    const r = await fetch('/api/admin/leads?' + params.toString())
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      setLeads(j.leads ?? [])
      const c: Record<string, number> = {}
      for (const x of j.counts ?? []) c[x.status] = x._count?._all ?? 0
      setCounts(c)
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus])

  async function updateLead(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) await load()
  }

  const totalLeads = useMemo(
    () => Object.values(counts).reduce((s, n) => s + n, 0),
    [counts],
  )

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Leads — clientes dos nossos clientes
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Cada cadastro completo no portal vira um lead aqui.{' '}
          <span className="font-medium">{totalLeads}</span> leads totais.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFiltroStatus('')}
          className={
            'rounded border px-3 py-1 text-sm ' +
            (!filtroStatus
              ? 'border-green-700 bg-green-50 text-green-800'
              : 'border-gray-300 bg-white text-gray-700')
          }
        >
          Todos ({totalLeads})
        </button>
        {STATUS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFiltroStatus(s.key)}
            className={
              'rounded border px-3 py-1 text-sm ' +
              (filtroStatus === s.key
                ? 'border-current'
                : 'border-gray-300 text-gray-700')
            }
            style={
              filtroStatus === s.key
                ? { color: s.cor, background: s.cor + '20' }
                : {}
            }
          >
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Buscar nome, email, CPF/CNPJ…"
          className="ml-auto rounded border px-3 py-1 text-sm"
        />
        <button onClick={load} className="rounded bg-gray-100 px-3 py-1 text-sm">
          Buscar
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Nome</th>
                <th className="p-2">Email</th>
                <th className="p-2">Cargo</th>
                <th className="p-2">Cidade/UF</th>
                <th className="p-2">Origem (corretora)</th>
                <th className="p-2">Status</th>
                <th className="p-2">Criado</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="p-2 font-medium">
                    {l.nomeCompleto ?? '—'}
                    {l.whatsapp && (
                      <div className="text-[11px] text-gray-500">📱 {l.whatsapp}</div>
                    )}
                  </td>
                  <td className="p-2">{l.email}</td>
                  <td className="p-2">{l.cargoEmpresa ?? '—'}</td>
                  <td className="p-2">
                    {l.cidade ?? '—'}/{l.uf ?? '—'}
                  </td>
                  <td className="p-2">{l.origemWorkspace.name}</td>
                  <td className="p-2">
                    <select
                      value={l.status}
                      onChange={(e) => updateLead(l.id, { status: e.target.value })}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {STATUS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-xs text-gray-500">
                    {new Date(l.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => setEditando(editando === l.id ? null : l.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {editando === l.id ? 'Fechar' : 'Notas'}
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    Nenhum lead.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <NotaEditor
          lead={leads.find((l) => l.id === editando)!}
          onSave={(obs) => {
            updateLead(editando, { observacao: obs })
            setEditando(null)
          }}
          onCancel={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function NotaEditor({
  lead,
  onSave,
  onCancel,
}: {
  lead: Lead
  onSave: (obs: string) => void
  onCancel: () => void
}) {
  const [obs, setObs] = useState(lead.observacao ?? '')
  return (
    <div className="rounded-lg border bg-yellow-50/40 p-4">
      <div className="text-sm font-medium mb-2">
        Notas internas — {lead.email}
      </div>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        rows={4}
        className="w-full rounded border px-2 py-1 text-sm"
        placeholder="Histórico do contato, próximos passos…"
      />
      <div className="mt-2 flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded border px-3 py-1 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => onSave(obs)}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
