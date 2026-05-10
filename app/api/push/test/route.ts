/**
 * Envia notificação de teste para todas as subscriptions ativas do user logado.
 * Subscriptions com 410 Gone são desativadas.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushNotification, isPushConfigured } from '@/lib/push/web-push'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: 'VAPID não configurado no servidor' },
      { status: 503 }
    )
  }

  const subs = await db.pushSubscription.findMany({
    where: { userId: session.user.id, ativo: true },
  })
  if (subs.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma inscrição ativa' },
      { status: 404 }
    )
  }

  let sent = 0
  let failed = 0
  for (const s of subs) {
    const r = await sendPushNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      {
        title: 'BH Grain — teste',
        body: 'Notificações ativadas com sucesso.',
        url: '/dashboard',
        tag: 'test',
      }
    )
    if (r.ok) {
      sent++
      await db.pushSubscription.update({
        where: { id: s.id },
        data: { ultimoEnvio: new Date() },
      })
    } else {
      failed++
      // 404/410 → desativar
      if (r.statusCode === 404 || r.statusCode === 410) {
        await db.pushSubscription.update({
          where: { id: s.id },
          data: { ativo: false },
        })
      }
    }
  }

  return NextResponse.json({ sent, failed, total: subs.length })
}
