/**
 * /propostas/kanban — Quadro Kanban full-screen de propostas.
 *
 * Tela dedicada (não o toggle dentro de /propostas). Cada card é uma proposta;
 * arrastar entre colunas chama PATCH /api/propostas/[id]/status, que VALIDA a
 * transição (lib/propostas/transicoes.ts), registra audit e aplica efeitos —
 * o Kanban não faz update cru.
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { KanbanBoard } from './_components/KanbanBoard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kanban de propostas' }

export default async function KanbanPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  return (
    <AppShell>
      <KanbanBoard />
    </AppShell>
  )
}
