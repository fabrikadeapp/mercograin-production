'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'

export function PosicaoActions({
  posicaoId,
  status,
}: {
  posicaoId: string
  status: string
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  async function marcar() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/hedge/posicoes/${posicaoId}/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Erro')
      }
      setMsg('Marcação registrada.')
      router.refresh()
    } catch (e: any) {
      setMsg(`Erro: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function fechar() {
    const precoStr = window.prompt('Preço de saída (USD/bu)')
    if (!precoStr) return
    const cambioStr = window.prompt('Câmbio de saída (USD/BRL)')
    if (!cambioStr) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/hedge/posicoes/${posicaoId}/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precoSaidaUsdBu: Number(precoStr),
          cambioSaidaUsdBrl: Number(cambioStr),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Erro')
      }
      setMsg('Posição fechada.')
      router.refresh()
    } catch (e: any) {
      setMsg(`Erro: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      {status === 'aberta' ? (
        <>
          <Button variant="primary" onClick={marcar} loading={busy}>
            Marcar agora
          </Button>
          <Button variant="secondary" onClick={fechar} disabled={busy}>
            Fechar posição
          </Button>
        </>
      ) : null}
      {msg ? <span className="text-small text-fg-3">{msg}</span> : null}
    </div>
  )
}
