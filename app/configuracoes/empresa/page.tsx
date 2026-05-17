import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { EmpresaForm } from './_components/EmpresaForm'
import { CodigoWorkspaceCard } from './_components/CodigoWorkspaceCard'

export const dynamic = 'force-dynamic'

export default async function EmpresaConfigPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const allowed =
    scope.isAdmin || ['owner', 'admin'].includes(scope.workspaceRole)
  if (!allowed) redirect('/dashboard')

  const [empresa, workspace] = await Promise.all([
    db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { codigo: true, name: true },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações · Workspace"
        title="Dados da empresa"
        subtitle="CNPJ, razão social, endereço e contato. Aparecem em PDFs, boletos, e-mails e relatórios."
        search={false}
      />

      <CodigoWorkspaceCard
        initial={workspace?.codigo ?? null}
        nome={workspace?.name ?? ''}
      />

      <Card className="p-5 max-w-4xl">
        <EmpresaForm
          initial={
            empresa
              ? {
                  razaoSocial: empresa.razaoSocial ?? '',
                  nomeFantasia: empresa.nomeFantasia ?? '',
                  cnpj: empresa.cnpj ?? '',
                  inscricaoEstadual: empresa.inscricaoEstadual ?? '',
                  endereco: empresa.endereco ?? '',
                  cidade: empresa.cidade ?? '',
                  uf: empresa.uf ?? '',
                  cep: empresa.cep ?? '',
                  telefone: empresa.telefone ?? '',
                  email: empresa.email ?? '',
                  dadosBancarios: empresa.dadosBancarios as Record<string, unknown> | null,
                }
              : null
          }
        />
      </Card>
    </AppShell>
  )
}
