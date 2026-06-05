import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { SolicitarCotacaoView } from './_components/SolicitarCotacaoView'

export const dynamic = 'force-dynamic'

export default async function SolicitarPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  return <SolicitarCotacaoView />
}
