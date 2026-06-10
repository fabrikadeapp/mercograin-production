import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { FluxoContent } from './_components/FluxoContent'

export const dynamic = 'force-dynamic'

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const agora = new Date()
  const eyebrow = `Tesouraria · ${MESES_PT[agora.getMonth()]} ${agora.getFullYear()}`

  return (
    <AppShell>
      <PageHeader
        eyebrow={eyebrow}
        title="Fluxo de Caixa"
        subtitle="Saldo projetado para 90 dias · cenário base"
        actions={
          <a href="/api/fluxo-caixa/export" className="inline-flex">
            <Button leftIcon={<Download className="h-4 w-4" />}>Exportar CSV</Button>
          </a>
        }
      />
      <FluxoContent />
    </AppShell>
  )
}
