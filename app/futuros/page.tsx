import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { FuturosContent } from './_components/FuturosContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Pipeline futuros"
        title="Contratos Futuros"
        subtitle="Book próprio agregado por vencimento · B3 + CBOT"
        actions={
          <Link href="/futuros/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato futuro</Button>
          </Link>
        }
      />
      <FuturosContent />
    </AppShell>
  )
}
