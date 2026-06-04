/**
 * Página de assinatura do portal — recebe ?token=... vindo do email.
 * Detecta status do portal e renderiza o fluxo (signup/login/setup/perfil/consent/assinar).
 *
 * Vide docs/specs/assinaturapropriaonline.md §5
 *      docs/specs/portal-cliente-corretora-fase1.md (este épico)
 */
import { AssinarPortalView } from './_components/AssinarPortalView'

export const dynamic = 'force-dynamic'

export default function PortalAssinarPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string }
  searchParams: { token?: string }
}) {
  return (
    <AssinarPortalView
      workspaceSlug={params.workspaceSlug}
      token={searchParams.token ?? ''}
    />
  )
}
