/**
 * Ativação purchase-first: cria User + Workspace + WorkspaceMember + DadosEmpresa
 * a partir de uma License pendente. Liga workspaceId na license e marca status=active.
 *
 * Idempotente: se a license já está active (workspaceId preenchido), retorna 409.
 */
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePasswordStrength } from '@/lib/password-validator'
import { sendEmail } from '@/lib/email/send'
import { welcomeTemplate } from '@/lib/email/templates/welcome'
import { stripe } from '@/lib/stripe/server'
import { logAudit } from '@/lib/audit/log'
import { signIn } from '@/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  empresa: z.object({
    razaoSocial: z.string().min(2, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional().nullable(),
    cnpj: z.string().optional().nullable(),
    inscricaoEstadual: z.string().optional().nullable(),
    endereco: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    cep: z.string().optional().nullable(),
    telefone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    dadosBancarios: z.any().optional().nullable(),
  }),
})

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const license = await db.license.findUnique({ where: { onboardingToken: token } })
  if (!license) {
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 404 })
  }
  if (license.workspaceId || license.status === 'active') {
    return NextResponse.json(
      { error: 'Esta licença já foi ativada. Faça login.' },
      { status: 409 }
    )
  }
  if (license.onboardingExpiresAt && license.onboardingExpiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Link expirado. Solicite um novo na página de suporte.' },
      { status: 410 }
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const strength = validatePasswordStrength(body.senha)
  if (!strength.isValid) {
    return NextResponse.json(
      { error: 'Senha fraca', feedback: strength.feedback },
      { status: 400 }
    )
  }

  // Conflito: e-mail já registrado (corner case: cliente comprou com e-mail
  // que já tinha conta — bloqueado no /api/stripe/checkout-publico, mas defensivo).
  const existingUser = await db.user.findUnique({ where: { email: license.email } })
  if (existingUser) {
    return NextResponse.json(
      { error: 'Já existe um usuário com este e-mail. Faça login.' },
      { status: 409 }
    )
  }

  const hashedPassword = await hash(body.senha, 10)

  // Slug do workspace baseado em razão social ou nome
  const baseName = body.empresa.razaoSocial || body.nome
  const baseSlug = slugify(baseName) || `ws-${Date.now().toString(36)}`
  let slug = baseSlug
  let suffix = 1
  while (await db.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`
    if (suffix > 50) {
      slug = `${baseSlug}-${Date.now().toString(36)}`
      break
    }
  }
  const codigoWs =
    baseName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'WKS'

  // Transação: cria User → Workspace → Member → DadosEmpresa → liga License.
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        nome: body.nome,
        email: license.email,
        senha: hashedPassword,
        emailVerificado: true, // purchase confirma e-mail implicitamente
        stripeCustomerId: license.stripeCustomerId,
      },
    })

    const workspace = await tx.workspace.create({
      data: {
        name: baseName,
        slug,
        codigo: codigoWs,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            email: user.email,
            role: 'owner',
            status: 'active',
            acceptedAt: new Date(),
            areasPermitidas: [],
            funcoes: [],
          },
        },
        empresa: {
          create: {
            razaoSocial: body.empresa.razaoSocial,
            nomeFantasia: body.empresa.nomeFantasia || null,
            cnpj: body.empresa.cnpj || null,
            inscricaoEstadual: body.empresa.inscricaoEstadual || null,
            endereco: body.empresa.endereco || null,
            cidade: body.empresa.cidade || null,
            uf: body.empresa.uf || null,
            cep: body.empresa.cep || null,
            telefone: body.empresa.telefone || null,
            email: body.empresa.email || null,
            logoUrl: body.empresa.logoUrl || null,
            dadosBancarios: body.empresa.dadosBancarios ?? undefined,
          },
        },
      },
    })

    await tx.license.update({
      where: { id: license.id },
      data: {
        workspaceId: workspace.id,
        status: 'active',
        ativadaEm: new Date(),
        onboardingToken: null, // queima o token
      },
    })

    return { user, workspace }
  })

  // Sincroniza Subscription do Stripe (best-effort — webhook upsert pode
  // ter falhado por workspace não existir antes; agora existe).
  try {
    if (license.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(license.stripeSubscriptionId)
      const item = sub.items.data[0]
      const price = item?.price
      const periodStart =
        (item as any)?.current_period_start ?? (sub as any).current_period_start
      const periodEnd =
        (item as any)?.current_period_end ?? (sub as any).current_period_end
      await db.subscription.upsert({
        where: { workspaceId: result.workspace.id },
        create: {
          workspaceId: result.workspace.id,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: license.stripeCustomerId,
          stripePriceId: price?.id || '',
          plan: license.plano,
          status: sub.status,
          trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          memberCount: 1,
        },
        update: {
          status: sub.status,
          stripePriceId: price?.id || '',
          plan: license.plano,
        },
      })
    }
  } catch (e: any) {
    console.error('[ativar/completar] sub sync failed:', e?.message)
  }

  // Audit
  await logAudit({
    userId: result.user.id,
    workspaceId: result.workspace.id,
    acao: 'license_activation',
    entidade: 'license',
    entidadeId: license.id,
    mudancas: { codigo: license.codigo, plano: license.plano },
  }).catch(() => undefined)

  // Audit: workspace criado (via purchase-first onboarding)
  logAudit({
    userId: result.user.id,
    workspaceId: result.workspace.id,
    acao: 'workspace_create',
    entidade: 'workspace',
    entidadeId: result.workspace.id,
    mudancas: {
      origem: 'purchase-first',
      name: result.workspace.name,
      slug: result.workspace.slug,
      plano: license.plano,
    },
  }).catch(() => undefined)

  // Welcome email com código de licença
  try {
    const tpl = welcomeTemplate({
      name: body.nome,
      workspaceName: result.workspace.name,
      codigoLicenca: license.codigo,
    })
    await sendEmail({
      to: license.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: 'kind', value: 'welcome' },
        { name: 'codigo', value: license.codigo },
      ],
    })
  } catch (e: any) {
    console.error('[ativar/completar] welcome email failed:', e?.message)
  }

  // Login automático via NextAuth (Credentials).
  try {
    await signIn('credentials', {
      email: license.email,
      password: body.senha,
      redirect: false,
    })
  } catch (e: any) {
    // Se falhar (ex: rate-limit), o cliente pode logar manualmente.
    console.warn('[ativar/completar] auto signIn falhou:', e?.message)
  }

  return NextResponse.json({
    ok: true,
    redirect: '/dashboard',
    codigo: license.codigo,
  })
}
