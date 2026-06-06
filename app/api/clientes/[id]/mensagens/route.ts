import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { sendEmail } from '@/lib/email-service'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'

const schema = z.object({ texto: z.string().min(1).max(2000) })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const mensagens = await db.mensagemProdutor.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json({ mensagens })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      produtorAccess: {
        select: { emailLogin: true, whatsapp: true, telefone: true, nomeCompleto: true },
      },
    },
  })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })

  const msg = await db.mensagemProdutor.create({
    data: {
      workspaceId: cliente.workspaceId,
      clienteId: cliente.id,
      remetente: 'corretora',
      texto: parsed.data.texto,
    },
  })

  // Notificações em paralelo (não bloqueiam o response)
  const ws = await db.workspace.findUnique({
    where: { id: cliente.workspaceId },
    select: { name: true, slug: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  })
  const brandNome =
    ws?.empresa?.nomeFantasia || ws?.empresa?.razaoSocial || ws?.name || 'sua corretora'
  const linkPortal = `${process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'}/portal/${ws?.slug ?? ''}/chat`
  const pa = cliente.produtorAccess
  const nomeDest = pa?.nomeCompleto ?? cliente.nome ?? ''
  const emailDest = pa?.emailLogin ?? cliente.email ?? null
  const waDest = pa?.whatsapp ?? pa?.telefone ?? cliente.whatsapp ?? cliente.telefone ?? null

  // Email
  if (emailDest) {
    sendEmail({
      to: emailDest,
      subject: `Nova mensagem de ${brandNome}`,
      html: `<p>Olá ${nomeDest},</p>
<p><strong>${brandNome}</strong> enviou uma mensagem para você:</p>
<blockquote style="border-left:3px solid #0a8a3a;padding:8px 12px;margin:12px 0;color:#333">${parsed.data.texto.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</blockquote>
<p><a href="${linkPortal}">Responder no portal</a></p>
<hr/>
<p style="font-size:11px;color:#aaa">powered by <strong>BH Grain</strong></p>`,
      text: `${brandNome} enviou: ${parsed.data.texto}\n\nResponder: ${linkPortal}\n\npowered by BH Grain`,
    }).catch((err) => console.warn('[chat] email falhou:', err))
  }

  // WhatsApp
  if (waDest) {
    sendWhatsAppMessage(
      waDest,
      `💬 *${brandNome}*\n\n${parsed.data.texto}\n\n_Responder: ${linkPortal}_\n\n_powered by BH Grain_`,
    ).catch((err) => console.warn('[chat] whatsapp falhou:', err))
  }

  return NextResponse.json({
    mensagem: msg,
    notif: { email: !!emailDest, whatsapp: !!waDest },
  })
}
