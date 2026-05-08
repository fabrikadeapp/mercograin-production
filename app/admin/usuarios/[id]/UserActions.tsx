'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'
import { UserCog, Pause, Play, Trash2, KeyRound } from 'lucide-react'

export function UserActions({
  userId,
  hasSubscription,
  isCanceled,
}: {
  userId: string
  hasSubscription: boolean
  isCanceled: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [enableImpersonate, setEnableImpersonate] = React.useState(false)

  React.useEffect(() => {
    // Lê flag pública via endpoint
    fetch('/api/admin/health')
      .then((r) => r.json())
      .then((d) => setEnableImpersonate(!!d.flags?.impersonate))
      .catch(() => {})
  }, [])

  async function call(action: string, method: 'POST' | 'DELETE' = 'POST') {
    if (busy) return
    if (
      action === 'delete' &&
      !confirm('Tem certeza? Esta ação remove o usuário e todos os dados.')
    )
      return
    setBusy(action)
    try {
      const r = await fetch(`/api/admin/users/${userId}/${action}`, {
        method,
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        alert(`Erro: ${d.error ?? r.statusText}`)
        return
      }
      if (action === 'delete') {
        router.push('/admin/usuarios')
        return
      }
      if (action === 'impersonate') {
        const d = await r.json()
        if (d.url) window.location.href = d.url
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {enableImpersonate && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => call('impersonate')}
          disabled={busy !== null}
        >
          <UserCog className="h-4 w-4 mr-1.5" />
          Impersonate
        </Button>
      )}
      {hasSubscription && !isCanceled && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => call('suspend')}
          disabled={busy !== null}
        >
          <Pause className="h-4 w-4 mr-1.5" />
          Cancelar assinatura
        </Button>
      )}
      {hasSubscription && isCanceled && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => call('reactivate')}
          disabled={busy !== null}
        >
          <Play className="h-4 w-4 mr-1.5" />
          Reativar
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => call('delete', 'DELETE')}
        disabled={busy !== null}
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        Excluir
      </Button>
    </div>
  )
}
