import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { listFiles } from '@/lib/supabase/storage'
import { BackupsContent } from './_components/BackupsContent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BackupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== 'admin') redirect('/dashboard')

  let backups: Array<{ name: string; size: number | null; createdAt: string | null }> = []
  let loadError: string | null = null
  try {
    const files = await listFiles('phb-grain-backups')
    backups = files
      .map((f) => ({
        name: f.name,
        size:
          (f.metadata as { size?: number } | null | undefined)?.size ?? null,
        createdAt: f.created_at ?? null,
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : 'Erro ao listar backups'
  }

  return <BackupsContent initialBackups={backups} loadError={loadError} />
}
