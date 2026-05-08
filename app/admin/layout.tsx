import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { AdminShell } from './_components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, nome: true, email: true },
  })
  if (!u || u.role !== 'admin') redirect('/dashboard')
  return (
    <AdminShell user={{ nome: u.nome, email: u.email }}>{children}</AdminShell>
  )
}
