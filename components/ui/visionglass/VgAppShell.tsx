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
  backgroundImage = '/visionglass/bg-hero.jpg',
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
        // NewDB v2: fundo sólido com radial gradients suaves (sem foto).
        background:
          'radial-gradient(1200px 700px at 10% -10%, var(--accent-soft), transparent 60%), ' +
          'radial-gradient(900px 500px at 100% 0%, var(--accent-2-soft), transparent 60%), ' +
          'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <VgTopBar
        userName={user?.nome ?? user?.email ?? null}
        userEmail={user?.email ?? null}
        userRole={user?.role ?? null}
        workspaceName={workspace?.name ?? null}
      />

      <main className="pt-24 pb-4 px-4 md:px-6 relative z-0">
        <div className="mx-auto w-full" style={{ maxWidth }}>
          {children}
        </div>
      </main>
    </div>
  )
}
