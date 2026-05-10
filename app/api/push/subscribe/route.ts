import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getActiveWorkspace } from '@/lib/auth/scope'

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 })
  }

  const ws = await getActiveWorkspace(session.user.id)

  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: session.user.id,
      workspaceId: ws?.workspaceId ?? null,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    update: {
      userId: session.user.id,
      workspaceId: ws?.workspaceId ?? null,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      ativo: true,
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  }
  await db.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })
  return NextResponse.json({ success: true })
}
