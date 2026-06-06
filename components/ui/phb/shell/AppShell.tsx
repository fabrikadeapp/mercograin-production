'use client'
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { AreaShell } from './AreaShell'

export interface AppShellProps {
  children: React.ReactNode
}

interface NavState {
  features: Record<string, boolean>
  permittedAreas?: string[]
  userName?: string
  workspaceName?: string
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
          loaded: true,
        })
      })
      .catch(() => setState((s) => ({ ...s, loaded: true })))
    return () => {
      cancel = true
    }
  }, [session?.user])

  return (
    <AreaShell
      enabledFeatures={state.features}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      permittedAreas={state.permittedAreas as any}
      userName={state.userName}
      workspaceName={state.workspaceName}
    >
      {children}
    </AreaShell>
  )
}
