import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { FEATURES, loadFeaturesFor } from '@/lib/features'
import { FeaturesToggleList } from './_components/FeaturesToggleList'

export const dynamic = 'force-dynamic'

export default async function WorkspaceFeaturesPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const u = session.user as any
  if (u.role !== 'admin') redirect('/dashboard')

  const workspace = await db.workspace.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, codigo: true },
  })
  if (!workspace) notFound()

  const state = await loadFeaturesFor(params.id)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <a
          href="/admin/workspaces"
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            textDecoration: 'none',
            marginBottom: 8,
            display: 'inline-block',
          }}
        >
          ← Workspaces
        </a>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 6,
            marginTop: 8,
          }}
        >
          SUPER-ADMIN · FEATURE FLAGS
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {workspace.name} <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>·</span>{' '}
          <code style={{ fontFamily: 'var(--f-mono)' }}>{workspace.codigo}</code>
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)' }}>
          Ative ou desative módulos contratados. Mudanças aplicadas
          imediatamente, podem requerer logout/login para refletir na UI do user.
        </p>
      </header>

      <FeaturesToggleList
        workspaceId={params.id}
        catalog={FEATURES as any}
        initial={state}
      />
    </div>
  )
}
