import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { FornecedoresContent } from './_components/FornecedoresContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const scope = await getScope()
  let total = 0
  let ativos = 0
  if (scope) {
    ;[total, ativos] = await Promise.all([
      db.fornecedor.count({ where: scope.whereOwn() }),
      db.fornecedor.count({ where: scope.whereOwn({ ativo: true }) }),
    ])
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cadastros · Suprimentos"
        title="Fornecedores"
        subtitle={`${ativos} ativo${ativos === 1 ? '' : 's'} · ${total} total`}
        search={false}
        actions={
          <Link href="/fornecedores/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              Novo fornecedor
            </Button>
          </Link>
        }
      />
      <FornecedoresContent />
    </AppShell>
  )
}
