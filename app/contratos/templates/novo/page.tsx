import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { TemplateForm } from '../_TemplateForm'

export const dynamic = 'force-dynamic'

const TIPOS = ['venda', 'compra', 'intermediacao', 'outros', 'proposta'] as const
type TemplateTipo = (typeof TIPOS)[number]

export default async function Page({
  searchParams,
}: {
  searchParams?: { tipo?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const tipoParam = searchParams?.tipo
  const tipo: TemplateTipo | undefined =
    tipoParam && (TIPOS as readonly string[]).includes(tipoParam)
      ? (tipoParam as TemplateTipo)
      : undefined
  const isProposta = tipo === 'proposta'

  return (
    <AppShell>
      <PageHeader
        eyebrow={isProposta ? 'Propostas · Modelos' : 'Contratos · Templates'}
        title={isProposta ? 'Novo modelo de proposta' : 'Novo template'}
        subtitle="Crie um modelo reutilizável com variáveis dinâmicas"
      />
      <TemplateForm mode="create" initial={tipo ? { tipo } : undefined} />
    </AppShell>
  )
}
