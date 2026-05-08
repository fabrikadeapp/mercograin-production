'use client'
import * as React from 'react'
import { Button } from '@/components/ui/phb'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function ForceSyncButton() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/cotacoes/sync', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        setMsg(`Erro: ${d.error ?? r.statusText}`)
      } else {
        setMsg(`✓ ${d.created} snapshots criados`)
        router.refresh()
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-fg-3 text-small">{msg}</span>}
      <Button onClick={run} disabled={busy}>
        <RefreshCw
          className={`h-4 w-4 mr-1.5 ${busy ? 'animate-spin' : ''}`}
        />
        {busy ? 'Sincronizando…' : 'Forçar sync agora'}
      </Button>
    </div>
  )
}
