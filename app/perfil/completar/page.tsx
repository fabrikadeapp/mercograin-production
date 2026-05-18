import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { CompletarPerfilWizard } from './_components/CompletarPerfilWizard'

export const dynamic = 'force-dynamic'

export default async function CompletarPerfilPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nome: true,
      email: true,
      perfilCompleto: true,
      cpf: true,
      telefone: true,
      rg: true,
      rgEmissor: true,
      dataNascimento: true,
      pis: true,
      enderecoCep: true,
      enderecoRua: true,
      enderecoNumero: true,
      enderecoComplemento: true,
      enderecoBairro: true,
      enderecoCidade: true,
      enderecoUF: true,
      dadosBancariosJson: true,
      contatoEmergenciaNome: true,
      contatoEmergenciaTelefone: true,
      workspacesOwned: { select: { id: true }, take: 1 },
    },
  })

  if (!user) redirect('/auth/login')

  // Owner não precisa do wizard
  if (user.perfilCompleto || user.workspacesOwned.length > 0) {
    redirect('/dashboard')
  }

  // Tenta puxar CPF/telefone pré-cadastrados no WorkspaceMember (owner já preencheu)
  const member = await db.workspaceMember.findFirst({
    where: { userId: user.id, status: 'active' },
    select: { cpf: true, telefoneWhats: true },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <CompletarPerfilWizard
      nome={user.nome}
      email={user.email}
      initial={{
        cpf: user.cpf ?? member?.cpf ?? '',
        telefone: user.telefone ?? member?.telefoneWhats ?? '',
        rg: user.rg ?? '',
        rgEmissor: user.rgEmissor ?? '',
        dataNascimento: user.dataNascimento ? user.dataNascimento.toISOString().slice(0, 10) : '',
        pis: user.pis ?? '',
        enderecoCep: user.enderecoCep ?? '',
        enderecoRua: user.enderecoRua ?? '',
        enderecoNumero: user.enderecoNumero ?? '',
        enderecoComplemento: user.enderecoComplemento ?? '',
        enderecoBairro: user.enderecoBairro ?? '',
        enderecoCidade: user.enderecoCidade ?? '',
        enderecoUF: user.enderecoUF ?? '',
        dadosBancarios: (user.dadosBancariosJson as any) || {
          banco: '',
          bancoNome: '',
          agencia: '',
          conta: '',
          tipo: 'corrente',
          titular: user.nome ?? '',
          pix: '',
          pixTipo: '',
        },
        contatoEmergenciaNome: user.contatoEmergenciaNome ?? '',
        contatoEmergenciaTelefone: user.contatoEmergenciaTelefone ?? '',
      }}
    />
  )
}
