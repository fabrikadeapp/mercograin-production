/**
 * POST /api/admin/email/test
 * Renderiza um template com dados fake e envia. Útil para revisão visual.
 *
 * Body: { template: string, to: string }
 * Auth: requer user com role='admin' (requireAdmin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { sendEmail } from '@/lib/email/send'
import { welcomeTemplate } from '@/lib/email/templates/welcome'
import { trialEndingTemplate } from '@/lib/email/templates/trial-ending'
import { trialExpiredTemplate } from '@/lib/email/templates/trial-expired'
import { contractCreatedTemplate } from '@/lib/email/templates/contract-created'
import { contractSignedTemplate } from '@/lib/email/templates/contract-signed'
import { boletoGeneratedTemplate } from '@/lib/email/templates/boleto-generated'
import { priceAlertTemplate } from '@/lib/email/templates/price-alert'

const TEMPLATES = [
  'welcome',
  'trial-ending',
  'trial-expired',
  'contract-created',
  'contract-signed',
  'boleto-generated',
  'price-alert',
] as const

const schema = z.object({
  template: z.enum(TEMPLATES),
  to: z.string().email(),
})

function renderFake(name: typeof TEMPLATES[number]) {
  switch (name) {
    case 'welcome':
      return welcomeTemplate({ name: 'João Silva', workspaceName: 'Trading BH' })
    case 'trial-ending':
      return trialEndingTemplate({ name: 'João Silva', workspaceName: 'Trading BH', daysLeft: 3, planName: 'Pro' })
    case 'trial-expired':
      return trialExpiredTemplate({ name: 'João Silva' })
    case 'contract-created':
      return contractCreatedTemplate({
        contractNumber: 'CTR-2026-001',
        contractUrl: 'https://www.profitsync.ia.br/contratos/exemplo',
        corretoraName: 'BH Trading LTDA',
        granoLabel: 'soja',
        quantidadeSc: 1500,
        precoSc: 145.5,
      })
    case 'contract-signed':
      return contractSignedTemplate({
        contractNumber: 'CTR-2026-001',
        signerName: 'Maria Cliente',
        signedAt: new Date(),
        contractUrl: 'https://www.profitsync.ia.br/contratos/exemplo',
      })
    case 'boleto-generated':
      return boletoGeneratedTemplate({
        payerName: 'Maria Cliente',
        valor: 217500,
        vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        linkBoleto: 'https://exemplo.braspag.com.br/boleto/abc',
        linkPdf: 'https://exemplo.braspag.com.br/boleto/abc.pdf',
        numero: 'BLT-2026-001',
        linhaDigitavel: '23793.39001 60000.000007 00000.000000 1 99990000021750',
      })
    case 'price-alert':
      return priceAlertTemplate({
        name: 'João Operador',
        granoLabel: 'soja',
        precoAtual: 148.32,
        alvoLabel: '≥ R$ 145,00',
        fonte: 'CEPEA-ESALQ',
      })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { template, to } = schema.parse(body)
    const tpl = renderFake(template)
    const r = await sendEmail({
      to,
      subject: `[TEST] ${tpl.subject}`,
      html: tpl.html,
      text: tpl.text,
      tags: [{ name: 'env', value: 'admin-test' }, { name: 'template', value: template }],
    })
    return NextResponse.json({ ok: r !== null, result: r, template, to })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 })
    }
    return adminErrorResponse(err)
  }
}
