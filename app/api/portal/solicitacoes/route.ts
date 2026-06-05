/**
 * Portal — solicitações de cotação do produtor.
 * GET  → lista as próprias solicitações (com status/resposta).
 * POST → cria nova solicitação e notifica equipe da corretora por email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { sendEmail } from '@/lib/email-service'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const items = await db.solicitacaoCotacao.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { proposta: { select: { id: true, numero: true, valorTotal: true, status: true } } },
  })
  return NextResponse.json({ ok: true, items })
}

const postSchema = z.object({
  tipo: z.enum(['venda', 'compra']).default('venda'),
  grao: z.string().min(2).max(40),
  quantidade: z.number().positive(),
  unidade: z.enum(['t', 'sc']).default('t'),
  precoAlvo: z.number().positive().optional(),
  prazoEntregaDias: z.number().int().positive().max(365).optional(),
  localEntrega: z.string().max(160).optional(),
  observacao: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const cliente = await db.cliente.findFirst({
    where: { id: scope.clienteId, workspaceId: scope.workspaceId },
    select: { nome: true },
  })
  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { name: true, slug: true, empresa: { select: { email: true, nomeFantasia: true, razaoSocial: true } } },
  })
  const brandNome = ws?.empresa?.nomeFantasia || ws?.empresa?.razaoSocial || ws?.name || 'sua corretora'

  const sol = await db.solicitacaoCotacao.create({
    data: {
      workspaceId: scope.workspaceId,
      clienteId: scope.clienteId,
      produtorAccessId: scope.accessId,
      tipo: d.tipo,
      grao: d.grao.toLowerCase(),
      quantidade: d.quantidade,
      unidade: d.unidade,
      precoAlvo: d.precoAlvo,
      prazoEntregaDias: d.prazoEntregaDias,
      localEntrega: d.localEntrega,
      observacao: d.observacao,
      status: 'pendente',
    },
  })

  // Email para a equipe da corretora
  const staffEmails = await db.user.findMany({
    where: {
      workspaceMemberships: {
        some: {
          workspaceId: scope.workspaceId,
          role: { in: ['owner', 'admin'] },
        },
      },
    },
    select: { email: true },
  })
  const destinatarios = Array.from(
    new Set([...staffEmails.map((u) => u.email), ws?.empresa?.email].filter(Boolean) as string[]),
  )
  const appUrl = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
  const linkPainel = `${appUrl}/solicitacoes/${sol.id}`
  for (const to of destinatarios) {
    sendEmail({
      to,
      subject: `Nova solicitação de cotação · ${cliente?.nome ?? 'cliente'}`,
      html: `<p>Olá,</p>
<p>O cliente <strong>${cliente?.nome ?? 'sem nome'}</strong> abriu uma solicitação de cotação no portal:</p>
<ul>
  <li><strong>Tipo:</strong> ${d.tipo === 'venda' ? 'Venda (produtor quer vender)' : 'Compra'}</li>
  <li><strong>Grão:</strong> ${d.grao}</li>
  <li><strong>Quantidade:</strong> ${d.quantidade} ${d.unidade}</li>
  ${d.precoAlvo ? `<li><strong>Preço alvo:</strong> R$ ${d.precoAlvo}</li>` : ''}
  ${d.prazoEntregaDias ? `<li><strong>Prazo entrega:</strong> ${d.prazoEntregaDias} dias</li>` : ''}
  ${d.localEntrega ? `<li><strong>Local:</strong> ${d.localEntrega}</li>` : ''}
  ${d.observacao ? `<li><strong>Obs.:</strong> ${d.observacao}</li>` : ''}
</ul>
<p><a href="${linkPainel}">Abrir no painel</a></p>
<hr/>
<p style="font-size:11px;color:#aaa">${brandNome} · powered by <strong>BH Grain</strong></p>`,
      text: `Nova solicitação de ${cliente?.nome}: ${d.quantidade} ${d.unidade} de ${d.grao}. Acesse ${linkPainel}`,
    }).catch((err) => console.warn('[solicitacao] email staff falhou:', err))
  }

  await logAudit({
    userId: 'portal-produtor',
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'SolicitacaoCotacao',
    entidadeId: sol.id,
    mudancas: { tipo: d.tipo, grao: d.grao, quantidade: d.quantidade },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, solicitacao: sol })
}
