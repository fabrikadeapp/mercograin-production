import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { TemplateForm } from '../../_TemplateForm'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const template = await db.contratoTemplate.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!template) notFound()

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contratos · Templates"
        title={`Editar: ${template.nome}`}
        subtitle="Modifique conteúdo e variáveis do template"
      />
      <TemplateForm
        mode="edit"
        initial={{
          id: template.id,
          nome: template.nome,
          tipo: template.tipo as any,
          descricao: template.descricao,
          contentJson: template.contentJson,
          isDefault: template.isDefault,
        }}
      />
    </AppShell>
  )
}
