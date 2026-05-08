import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { FornecedorForm } from '../../_components/FornecedorForm'

export const dynamic = 'force-dynamic'

export default async function EditarFornecedorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const fornecedor = await db.fornecedor.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })

  if (!fornecedor) notFound()

  return (
    <FornecedorForm
      mode="update"
      fornecedorId={fornecedor.id}
      initial={{
        id: fornecedor.id,
        tipo: fornecedor.tipo as any,
        razaoSocial: fornecedor.razaoSocial,
        nomeFantasia: fornecedor.nomeFantasia,
        cnpj: fornecedor.cnpj,
        contato: fornecedor.contato,
        telefone: fornecedor.telefone,
        email: fornecedor.email,
        endereco: fornecedor.endereco,
        cidade: fornecedor.cidade,
        uf: fornecedor.uf,
        observacao: fornecedor.observacao,
        ativo: fornecedor.ativo,
        metadata: (fornecedor.metadata as Record<string, any>) || null,
      }}
    />
  )
}
