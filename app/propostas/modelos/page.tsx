import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { TemplatesList } from '@/app/contratos/templates/_TemplatesList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Modelos de proposta' }

/**
 * /propostas/modelos — editor de modelos de PROPOSTA.
 * Reusa o CRUD de ContratoTemplate (Tiptap, variáveis dinâmicas, versionamento)
 * filtrando por tipo='proposta'. Mesmo motor dos modelos de contrato.
 */
export default async function ModelosPropostaPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader
        eyebrow="Propostas · Modelos"
        title="Modelos de proposta"
        subtitle="Modelos reutilizáveis de proposta, com variáveis dinâmicas ({{cliente}}, {{valor}}…)."
        actions={
          <Link href="/contratos/templates/novo?tipo=proposta">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo modelo</Button>
          </Link>
        }
      />
      <TemplatesList filterTipo="proposta" />
    </AppShell>
  )
}
