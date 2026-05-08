import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { OnboardingWizard } from './_components/OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  // Tenta workspace owned; se não existe, primeira membership ativa
  let ws = await db.workspace.findFirst({
    where: { ownerId: session.user.id },
    include: { empresa: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!ws) {
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id, status: 'active' },
      include: { workspace: { include: { empresa: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (member?.workspace) ws = member.workspace
  }

  if (!ws) {
    // Sem workspace algum — situação inesperada (signup deveria criar). Vamos para login.
    redirect('/auth/login')
  }

  if (ws.onboardingCompletedAt) {
    redirect('/dashboard')
  }

  return (
    <OnboardingWizard
      workspace={{
        id: ws.id,
        name: ws.name,
        ownerName: session.user.name || session.user.email || '',
      }}
      initialEmpresa={
        ws.empresa
          ? {
              razaoSocial: ws.empresa.razaoSocial || '',
              nomeFantasia: ws.empresa.nomeFantasia || '',
              cnpj: ws.empresa.cnpj || '',
              inscricaoEstadual: ws.empresa.inscricaoEstadual || '',
              endereco: ws.empresa.endereco || '',
              cidade: ws.empresa.cidade || '',
              uf: ws.empresa.uf || '',
              cep: ws.empresa.cep || '',
              telefone: ws.empresa.telefone || '',
              email: ws.empresa.email || '',
              logoUrl: ws.empresa.logoUrl || '',
              dadosBancarios: (ws.empresa.dadosBancarios as any) || null,
            }
          : null
      }
    />
  )
}
