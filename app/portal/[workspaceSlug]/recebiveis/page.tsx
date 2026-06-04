/**
 * Recebíveis (boletos) do cliente da corretora.
 * Mostra resumo, lista filtrável (todos|abertos|vencidos|pagos), download de link
 * do boleto, cópia do número.
 */
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { RecebiveisView } from './_components/RecebiveisView'

export const dynamic = 'force-dynamic'

export default async function RecebiveisPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  return <RecebiveisView />
}
