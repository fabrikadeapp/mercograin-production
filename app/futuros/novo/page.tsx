import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { NovoFuturoForm } from './NovoFuturoForm'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const clientes = await db.cliente.findMany({
    where: { usuarioId: session.user.id, ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
    take: 200,
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Futuros"
        title="Novo contrato futuro"
        subtitle="Adicione uma proposta de compra ou venda com vencimento futuro"
        actions={
          <Link href="/futuros">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />
      <NovoFuturoForm clientes={clientes} />
    </AppShell>
  )
}
