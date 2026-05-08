import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { FornecedorForm } from '../_components/FornecedorForm'

export const dynamic = 'force-dynamic'

export default async function NovoFornecedorPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return <FornecedorForm mode="create" />
}
