'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { History, RotateCcw, Plus, ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'
import { Chip } from '@/components/ui/phb/primitives/Chip'
import { useToast } from '@/contexts/ToastContext'

interface Versao {
  id: string
  versao: number
  createdAt: string
  createdBy?: string | null
  comentario?: string | null
}

export default function TemplateVersoesPage() {
  const params = useParams<{ id: string }>()
  const toast = useToast()
  const [versoes, setVersoes] = useState<Versao[]>([])
  const [versaoAtual, setVersaoAtual] = useState<number>(1)
  const [busy, setBusy] = useState(false)
  const [comentario, setComentario] = useState('')
  const [open, setOpen] = useState(false)

  async function reload() {
    const r = await fetch(`/api/contratos/templates/${params.id}/versoes`)
    const data = await r.json()
    setVersoes(data?.versoes ?? [])
    setVersaoAtual(data?.versaoAtual ?? 1)
  }

  useEffect(() => {
    if (params?.id) reload()
  }, [params?.id])

  async function snapshot() {
    setBusy(true)
    const r = await fetch(`/api/contratos/templates/${params.id}/versoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentario: comentario || undefined }),
    })
    setBusy(false)
    if (!r.ok) {
      toast.error('Falha ao criar versão')
      return
    }
    toast.success('Nova versão criada')
    setComentario('')
    setOpen(false)
    reload()
  }

  async function reverter(versao: number) {
    if (!confirm(`Reverter o template para a versão ${versao}? Um snapshot da versão atual será criado antes.`)) return
    setBusy(true)
    const r = await fetch(
      `/api/contratos/templates/${params.id}/versoes/${versao}/reverter`,
      { method: 'POST' }
    )
    setBusy(false)
    if (!r.ok) {
      toast.error('Falha ao reverter')
      return
    }
    toast.success('Revertido')
    reload()
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Histórico de versões"
        subtitle={`Template ${params.id}`}
        search={false}
        showBell={false}
        actions={
          <div className="flex gap-2">
            <Link href={`/contratos/templates/${params.id}/editar`}>
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Voltar
              </Button>
            </Link>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Nova versão
            </Button>
          </div>
        }
      />

      <Card>
        <p className="eyebrow">Versão atual</p>
        <p className="t-num-lg text-accent mt-1">v{versaoAtual}</p>
      </Card>

      <div className="space-y-3 mt-6">
        {versoes.length === 0 && (
          <Card>
            <p className="text-fg-2">Nenhuma versão histórica registrada ainda.</p>
          </Card>
        )}
        {versoes.map((v) => (
          <Card key={v.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-fg-3" />
                  <span className="font-semibold">v{v.versao}</span>
                  {v.versao === versaoAtual && <Chip variant="pos">atual</Chip>}
                </div>
                <p className="text-fg-3 text-small mt-1">
                  {new Date(v.createdAt).toLocaleString('pt-BR')}
                  {v.createdBy && ` · por ${v.createdBy}`}
                </p>
                {v.comentario && (
                  <p className="text-fg-2 text-small mt-2">{v.comentario}</p>
                )}
              </div>
              {v.versao !== versaoAtual && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy}
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => reverter(v.versao)}
                >
                  Reverter
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="font-semibold mb-3">Nova versão (snapshot)</h3>
            <p className="text-fg-2 text-small mb-3">
              Vai capturar o conteúdo atual do template como v{versaoAtual + 1}.
            </p>
            <textarea
              className="w-full border border-border-1 rounded px-3 py-2 min-h-[80px]"
              placeholder="Comentário (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button loading={busy} onClick={snapshot}>Criar versão</Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
