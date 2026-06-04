import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { getPortalTheme } from '@/lib/portal-produtor/theme'
import { PortalShell } from '../_components/PortalShell'
import { PortalThemeBoot } from '../_components/PortalThemeBoot'
import '../portal-theme.css'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { workspaceSlug: string }
}) {
  const theme = await getPortalTheme()
  const session = await getPortalSession()

  // Sem sessão: renderiza apenas children (login/signup/reset/assinar público).
  if (!session) {
    return (
      <>
        <PortalThemeBoot theme={theme} />
        <div className="portal-root">{children}</div>
      </>
    )
  }

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: { nome: true },
  })
  const ws = await db.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { slug: true, name: true },
  })
  if (!cliente || !ws || ws.slug !== params.workspaceSlug) {
    redirect(`/portal/${params.workspaceSlug}/login`)
  }

  return (
    <>
      <PortalThemeBoot theme={theme} />
      <PortalShell
        theme={theme}
        slug={ws.slug}
        workspaceNome={ws.name}
        clienteNome={cliente.nome}
      >
        {children}
      </PortalShell>
    </>
  )
}
