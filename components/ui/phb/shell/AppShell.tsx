'use client'
import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertCircle } from 'lucide-react'
import { AreaShell } from './AreaShell'

export interface AppShellProps {
  children: React.ReactNode
}

interface NavState {
  features: Record<string, boolean>
  permittedAreas?: string[]
  userName?: string
  workspaceName?: string
  subscriptionStatus?: string | null
  loaded: boolean
}

/**
 * AppShell — topbar + sidebar contextual.
 *
 * Busca features habilitadas via /api/me/nav-context (server resolve).
 * Enquanto carrega, exibe o shell em modo neutro (sem features).
 */
export function AppShell({ children }: AppShellProps) {
  const { data: session } = useSession()
  const [state, setState] = React.useState<NavState>({
    features: {},
    loaded: false,
  })

  React.useEffect(() => {
    let cancel = false
    if (!session?.user) {
      setState((s) => ({ ...s, loaded: true }))
      return
    }
    fetch('/api/me/nav-context')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancel || !j) return
        setState({
          features: j.features ?? {},
          permittedAreas: j.permittedAreas,
          userName: j.userName,
          workspaceName: j.workspaceName,
          subscriptionStatus: j.subscriptionStatus ?? null,
          loaded: true,
        })
      })
      .catch(() => setState((s) => ({ ...s, loaded: true })))
    return () => {
      cancel = true
    }
  }, [session?.user])

  const pastDue = state.subscriptionStatus === 'past_due'

  return (
    <AreaShell
      enabledFeatures={state.features}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      permittedAreas={state.permittedAreas as any}
      userName={state.userName}
      workspaceName={state.workspaceName}
    >
      {pastDue && (
        <Link
          href="/assinatura"
          className="mb-4 flex items-start gap-2 rounded-md border border-l-2 border-border-1 bg-bg-2 p-3 text-small text-fg-1 no-underline hover:bg-bg-3"
          style={{ borderLeftColor: 'var(--warn)' }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            <strong>Pagamento atrasado.</strong> Não conseguimos cobrar sua
            assinatura. Atualize sua forma de pagamento para evitar a suspensão
            do acesso.{' '}
            <span className="font-semibold text-accent underline">
              Resolver agora →
            </span>
          </span>
        </Link>
      )}
      {children}
    </AreaShell>
  )
}
