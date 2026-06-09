/**
 * POST /api/portal/[slug]/lead — PÚBLICO (sem auth).
 *
 * Captação de lead a partir do formulário público da corretora (slug). Cria um
 * Cliente-prospect (statusCadastral='rascunho') no workspace da corretora — o
 * mesmo modelo do funil interno (/leads), então o lead cai direto na mesa.
 *
 * Proteções: rate-limit por IP (5/h) + honeypot (campo oculto 'website').
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  nome: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().min(8, 'Informe um contato').optional().or(z.literal('')),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  interesse: z.enum(['comprador', 'vendedor', 'ambos']).default('vendedor'),
  mensagem: z.string().max(800).optional(),
  // honeypot: bots preenchem; humanos não veem o campo
  website: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  // 1. Rate-limit por IP
  const ip = getClientIp(req)
  const rl = rateLimit(`portal-lead:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429 },
    )
  }

  // 2. Resolve corretora pelo slug
  const ws = await db.workspace.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  })
  if (!ws) {
    return NextResponse.json({ error: 'Corretora não encontrada' }, { status: 404 })
  }

  // 3. Valida payload
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // 4. Honeypot — se preenchido, finge sucesso (não cria nada).
  if (d.website && d.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  // 5. Exige pelo menos um contato.
  if (!d.email && !d.whatsapp) {
    return NextResponse.json(
      { error: 'Informe e-mail ou WhatsApp para contato.' },
      { status: 400 },
    )
  }

  // 6. Cria o Cliente-prospect (lead) no workspace da corretora.
  const endereco = [d.cidade, d.uf].filter(Boolean).join(' · ') || null
  const lead = await db.cliente.create({
    data: {
      workspaceId: ws.id,
      nome: d.nome,
      email: d.email || null,
      whatsapp: d.whatsapp || null,
      tipo: d.interesse,
      endereco,
      statusCadastral: 'rascunho', // lead novo no funil
      ativo: true,
    },
    select: { id: true },
  })

  await logAudit({
    userId: 'public',
    workspaceId: ws.id,
    acao: 'lead_criado',
    entidade: 'cliente',
    entidadeId: lead.id,
    mudancas: { nome: d.nome, origem: 'captacao_publica', ip },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
