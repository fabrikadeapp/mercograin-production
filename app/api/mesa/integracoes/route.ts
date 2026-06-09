/**
 * GET /api/mesa/integracoes
 *
 * Status das integrações e canais para o rodapé da Mesa. Lê IntegrationHealth
 * (uma linha por integração: whatsapp, email, instagram, precos/CEPEA, etc).
 *
 * Retorno: { ok, items: [{ integration, label, status, ok, responseTimeMs,
 *            lastError }], resumo: { online, total } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  portal: 'Portal',
  precos: 'CEPEA',
  ia: 'IA',
  financeiro: 'Financeiro',
}

const OK_STATUS = new Set(['online'])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rows = await db.integrationHealth.findMany({
    where: scope.whereOwn(),
    orderBy: { integration: 'asc' },
  })

  const items = rows.map((r) => ({
    integration: r.integration,
    label: LABEL[r.integration] ?? r.integration,
    status: r.status,
    ok: OK_STATUS.has(r.status),
    responseTimeMs: r.responseTimeMs,
    lastError: r.lastErrorMessage,
    paused: r.paused,
  }))

  return NextResponse.json({
    ok: true,
    items,
    resumo: {
      online: items.filter((i) => i.ok).length,
      total: items.length,
    },
  })
}
