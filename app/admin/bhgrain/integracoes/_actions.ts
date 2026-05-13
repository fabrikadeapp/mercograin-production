'use server'

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

const VALID_MODES = ['central', 'byo', 'hybrid'] as const

export async function setWhatsappMode(fd: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autorizado')
  const u = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (u?.role !== 'admin') throw new Error('Acesso negado: requer super-admin global')

  const modeRaw = String(fd.get('mode') ?? 'hybrid').toLowerCase()
  if (!(VALID_MODES as readonly string[]).includes(modeRaw)) throw new Error('Modo inválido')
  const mode = modeRaw as (typeof VALID_MODES)[number]

  const centralBaseUrl = String(fd.get('centralBaseUrl') ?? '').trim().slice(0, 500) || null
  const centralApiKeyNew = String(fd.get('centralApiKey') ?? '').trim().slice(0, 500) || null

  // Carrega existente para preservar apiKey se vier em branco
  const existing = await db.systemConfig.findUnique({ where: { key: 'bhgrain.whatsapp.mode' } })
  const existingValue = (existing?.value as { centralApiKey?: string } | null) ?? {}
  const finalApiKey = centralApiKeyNew ?? existingValue.centralApiKey ?? null

  await db.systemConfig.upsert({
    where: { key: 'bhgrain.whatsapp.mode' },
    create: {
      key: 'bhgrain.whatsapp.mode',
      value: { mode, centralBaseUrl, centralApiKey: finalApiKey },
      updatedBy: session.user.id,
    },
    update: {
      value: { mode, centralBaseUrl, centralApiKey: finalApiKey },
      updatedBy: session.user.id,
    },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      acao: 'Modo WhatsApp BH Grain atualizado',
      entidade: 'SystemConfig',
      entidadeId: 'bhgrain.whatsapp.mode',
      mudancas: { mode, centralBaseUrl, hasApiKey: !!finalApiKey },
    },
  })

  revalidatePath('/admin/bhgrain/integracoes')
  revalidatePath('/configuracoes/integracoes')
}
