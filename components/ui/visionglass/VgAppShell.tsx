/**
 * VgAppShell — shell paralelo ao AppShell atual, com estética VisionGlass.
 *
 * Diferenças do AppShell tradicional:
 *  - Sem sidebar lateral; topbar horizontal fixa no topo
 *  - Background com foto + scrim (visual spatial)
 *  - Conteúdo escala em max-width 1400px, padding generoso
 *  - Dock flutuante inferior (opcional, por ora só topbar)
 *
 * Server component que aceita um children. Para uso em rotas migradas.
 */
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { VgTopBar } from './VgTopBar'

interface Props {
  children: React.ReactNode
  /** Sobrescreve a foto de fundo. Default: /visionglass/bg-hero.png */
  backgroundImage?: string
  /** Largura máxima do conteúdo. Default: 1400px */
  maxWidth?: string
}

export async function VgAppShell({
  children,
  backgroundImage = '/visionglass/bg-hero.png',
  maxWidth = '1400px',
}: Props) {
  const session = await auth()
  const scope = await getScope().catch(() => null)

  const [user, workspace] = await Promise.all([
    session?.user?.id
      ? db.user
          .findUnique({
            where: { id: session.user.id },
            select: { nome: true, email: true, role: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    scope?.workspaceId
      ? db.workspace
          .findUnique({
            where: { id: scope.workspaceId },
            select: { name: true, slug: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ])

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(14,15,18,0.55) 0%, rgba(14,15,18,0.85) 100%), url('${backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        color: 'var(--vg-fg-primary)',
      }}
    >
      <VgTopBar
        userName={user?.nome ?? user?.email ?? null}
        userEmail={user?.email ?? null}
        userRole={user?.role ?? null}
        workspaceName={workspace?.name ?? null}
      />

      <main className="pt-20 pb-24 px-6 md:px-8 relative z-0">
        <div className="mx-auto w-full" style={{ maxWidth }}>
          {children}
        </div>
      </main>
    </div>
  )
}
