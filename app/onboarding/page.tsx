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
    // Sem workspace — primeiro login. Cria automaticamente.
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true },
    })
    const baseName = user?.nome?.trim() || user?.email?.split('@')[0] || 'Workspace'
    const baseSlug =
      baseName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || `ws-${Date.now().toString(36)}`

    // Slug único — adiciona sufixo se colidir
    let slug = baseSlug
    let suffix = 1
    while (await db.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`
      if (suffix > 50) {
        slug = `${baseSlug}-${Date.now().toString(36)}`
        break
      }
    }

    // Código 3 letras
    const codigo =
      baseName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'WKS'

    ws = (await db.workspace.create({
      data: {
        name: baseName,
        slug,
        codigo,
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            email: user?.email ?? '',
            role: 'owner',
            status: 'active',
            acceptedAt: new Date(),
            areasPermitidas: [],
            funcoes: [],
          },
        },
      },
      include: { empresa: true },
    })) as any
  }

  if (!ws) {
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
