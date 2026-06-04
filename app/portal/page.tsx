/**
 * /portal — entrada do produtor/cooperativa SEM precisar saber slug da corretora.
 * Login por email+senha; se houver múltiplas corretoras, mostra cards para escolher.
 */
import { PortalEntradaView } from './_components/PortalEntradaView'
import './portal-theme.css'

export const dynamic = 'force-dynamic'

export default function PortalEntradaPage() {
  return (
    <div className="portal-root" style={{ display: 'grid', placeItems: 'center', padding: 24, minHeight: '100vh' }}>
      <PortalEntradaView />
    </div>
  )
}
