'use server'

import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { setDemoMode } from '@/lib/bhgrain/demo-mode'

export async function setDemoModeAction(formData: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autorizado')
  const u = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (u?.role !== 'admin') throw new Error('Acesso negado')

  const enabled = String(formData.get('enabled') ?? '0') === '1'
  await setDemoMode(enabled, session.user.id)
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      acao: enabled ? 'Modo demo ativado' : 'Modo demo desativado',
      entidade: 'SystemConfig',
      entidadeId: 'bhgrain.demo',
      mudancas: { enabled },
    },
  })
  revalidatePath('/admin/bhgrain/demo')
  revalidatePath('/bhgrain')
}
