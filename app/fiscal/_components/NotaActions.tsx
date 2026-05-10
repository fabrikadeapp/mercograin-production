'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'
import { Download, X, FileEdit, RefreshCw } from 'lucide-react'

interface Props {
  notaId: string
  chave: string | null
  status: string
  xmlUrl: string | null
  danfeUrl: string | null
}

export function NotaActions({ notaId, chave, status }: Props) {
  const router = useRouter()
  const [acting, setActing] = React.useState(false)

  const canEmitir = status === 'rascunho' || status === 'rejeitada'
  const canCancelar = status === 'autorizada'
  const canCorrigir = status === 'autorizada'
  const canBaixar = status === 'autorizada' && !!chave

  async function emitir() {
    setActing(true)
    try {
      const r = await fetch(`/api/fiscal/notas/${notaId}/emitir`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) alert(`Erro: ${data.error ?? r.status}`)
      router.refresh()
    } finally {
      setActing(false)
    }
  }

  async function cancelar() {
    const motivo = window.prompt('Motivo do cancelamento (mín. 15 caracteres):')
    if (!motivo || motivo.length < 15) {
      if (motivo !== null) alert('Motivo deve ter ao menos 15 caracteres')
      return
    }
    setActing(true)
    try {
      const r = await fetch(`/api/fiscal/notas/${notaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const data = await r.json()
      if (!r.ok) alert(`Erro: ${data.error ?? r.status}`)
      router.refresh()
    } finally {
      setActing(false)
    }
  }

  async function corrigir() {
    const texto = window.prompt('Texto da carta de correção (15-1000 caracteres):')
    if (!texto || texto.length < 15) {
      if (texto !== null) alert('Texto deve ter ao menos 15 caracteres')
      return
    }
    setActing(true)
    try {
      const r = await fetch(`/api/fiscal/notas/${notaId}/carta-correcao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      const data = await r.json()
      if (!r.ok) alert(`Erro: ${data.error ?? data.providerResult?.erro ?? r.status}`)
      router.refresh()
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEmitir && (
        <Button onClick={emitir} disabled={acting}>
          <RefreshCw className="h-4 w-4 mr-1" />
          {status === 'rejeitada' ? 'Reemitir' : 'Enviar à SEFAZ'}
        </Button>
      )}
      {canBaixar && (
        <>
          <a href={`/api/fiscal/notas/${notaId}/danfe`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border-1 text-small hover:bg-bg-2">
            <Download className="h-4 w-4" /> DANFE PDF
          </a>
          <a href={`/api/fiscal/notas/${notaId}/xml`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border-1 text-small hover:bg-bg-2">
            <Download className="h-4 w-4" /> XML
          </a>
        </>
      )}
      {canCorrigir && (
        <Button variant="secondary" onClick={corrigir} disabled={acting}>
          <FileEdit className="h-4 w-4 mr-1" /> Carta de correção
        </Button>
      )}
      {canCancelar && (
        <Button variant="secondary" onClick={cancelar} disabled={acting}>
          <X className="h-4 w-4 mr-1" /> Cancelar NF-e
        </Button>
      )}
    </div>
  )
}
