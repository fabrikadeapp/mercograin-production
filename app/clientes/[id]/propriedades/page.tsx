'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Propriedade {
  id: string
  nome: string
  matricula?: string | null
  car?: string | null
  carStatus?: string | null
  areaTotalHa?: number | null
  municipio?: string | null
  uf?: string | null
}

export default function PropriedadesListPage() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params.id as string
  const [props, setProps] = useState<Propriedade[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteNome, setClienteNome] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [pr, cl] = await Promise.all([
        fetch(`/api/propriedades?produtorId=${clienteId}`).then((r) => r.json()),
        fetch(`/api/clientes/${clienteId}`).then((r) => r.json()),
      ])
      setProps(Array.isArray(pr) ? pr : [])
      setClienteNome(cl?.nome || 'Cliente')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [clienteId])

  async function inativar(id: string) {
    if (!confirm('Inativar esta propriedade?')) return
    await fetch(`/api/propriedades/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AppShell>
      <PageHeader
        title="Propriedades Rurais"
        subtitle={clienteNome}
        actions={
          <div className="flex gap-2">
            <Link href={`/clientes/${clienteId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            </Link>
            <Link href={`/clientes/${clienteId}/propriedades/nova`}>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Nova propriedade
              </Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <Card>Carregando…</Card>
      ) : props.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-neutral-500">
            <p>Nenhuma propriedade cadastrada para este produtor.</p>
            <Link href={`/clientes/${clienteId}/propriedades/nova`}>
              <Button className="mt-4">Cadastrar primeira propriedade</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {props.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{p.nome}</h3>
                  <div className="text-sm text-neutral-600 mt-1 space-y-0.5">
                    {p.matricula && <div>Matrícula: {p.matricula}</div>}
                    {p.car && (
                      <div>
                        CAR: <code className="text-xs">{p.car}</code>{' '}
                        {p.carStatus && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-neutral-100 text-xs">
                            {p.carStatus}
                          </span>
                        )}
                      </div>
                    )}
                    {p.areaTotalHa != null && <div>Área: {p.areaTotalHa} ha</div>}
                    {(p.municipio || p.uf) && (
                      <div>
                        {p.municipio} {p.uf && `/ ${p.uf}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/clientes/${clienteId}/propriedades/${p.id}`}>
                    <Button variant="ghost" size="sm">
                      Detalhes
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => inativar(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
