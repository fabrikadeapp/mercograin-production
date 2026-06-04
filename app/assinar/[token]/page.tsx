/**
 * Página pública de assinatura.
 *
 * Carrega metadata via /api/assinar/[token], mostra PDF embed +
 * formulário de assinatura. Sem auth.
 *
 * Vide docs/specs/assinaturapropriaonline.md §5.
 */

import { AssinarView } from './_components/AssinarView'

export const dynamic = 'force-dynamic'

export default function AssinarPage({
  params,
}: {
  params: { token: string }
}) {
  return <AssinarView token={params.token} />
}
