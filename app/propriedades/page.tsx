'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, MapPin } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, EmptyState, Skeleton } from '@/components/ui/phb'

interface Propriedade {
  id: string
  nome: string
  produtorId: string
  matricula?: string | null
  car?: string | null
  carStatus?: string | null
  areaTotalHa?: number | null
  municipio?: string | null
  uf?: string | null
}

interface Cliente {
  id: string
  nome: string
}

export default function PropriedadesGlobaisPage() {
  const [props, setProps] = useState<Propriedade[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [pr, cl] = await Promise.all([
          fetch(`/api/propriedades`).then((r) => r.json()),
          fetch(`/api/clientes`).then((r) => r.json()).catch(() => []),
        ])
        if (cancelled) return
        setProps(Array.isArray(pr) ? pr : [])
        const map: Record<string, string> = {}
        const arr: Cliente[] = Array.isArray(cl) ? cl : cl?.data ?? []
        for (const c of arr) map[c.id] = c.nome
        setClientesMap(map)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = props.filter((p) => {
    if (!q) return true
    const hay = `${p.nome} ${p.car ?? ''} ${p.municipio ?? ''} ${p.uf ?? ''} ${clientesMap[p.produtorId] ?? ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compliance · EUDR"
        title="Propriedades Rurais"
        subtitle="Visão consolidada · todos os produtores"
        search={false}
        showBell={false}
        actions={
          <Link href="/clientes">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              Nova propriedade
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <input
          type="search"
          placeholder="Buscar por nome, CAR, município, produtor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-pill border border-border-1 bg-bg-2 px-5 py-3 text-body outline-none focus:ring-2 focus:ring-accent"
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={72} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              icon={MapPin}
              title={q ? 'Nada encontrado' : 'Nenhuma propriedade cadastrada'}
              description={
                q
                  ? `Nenhuma propriedade corresponde a "${q}".`
                  : 'Cadastre uma propriedade pelo cliente correspondente.'
              }
              cta={
                !q ? (
                  <Link href="/clientes">
                    <Button leftIcon={<Plus className="h-4 w-4" />}>
                      Ir para clientes
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border-1 text-fg-3 text-micro uppercase tracking-wider">
                  <th className="text-left py-3 px-5">Propriedade</th>
                  <th className="text-left py-3 px-5">Produtor</th>
                  <th className="text-left py-3 px-5">Município / UF</th>
                  <th className="text-left py-3 px-5">CAR</th>
                  <th className="text-right py-3 px-5">Área (ha)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border-1 last:border-0 hover:bg-bg-2 transition cursor-pointer"
                    onClick={() => {
                      window.location.href = `/clientes/${p.produtorId}/propriedades/${p.id}`
                    }}
                  >
                    <td className="py-3 px-5 text-fg-1 font-medium">{p.nome}</td>
                    <td className="py-3 px-5 text-fg-2">
                      {clientesMap[p.produtorId] ?? '—'}
                    </td>
                    <td className="py-3 px-5 text-fg-2">
                      {p.municipio ? `${p.municipio}${p.uf ? ` · ${p.uf}` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-5 text-fg-2 t-num">
                      {p.car ?? '—'}
                    </td>
                    <td className="py-3 px-5 text-right text-fg-2 t-num">
                      {p.areaTotalHa != null
                        ? Number(p.areaTotalHa).toLocaleString('pt-BR', {
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
