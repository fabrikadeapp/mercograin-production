import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const tradingSchema = z.object({
  nome: z.string().min(1).max(60),
  premioCentavosBu: z.number().finite(),
})
const pracaSchema = z.object({
  nome: z.string().min(1).max(60),
  fretePorSacaBrl: z.number().finite().nonnegative(),
})

const configSchema = z.object({
  fobbingsUsdTon: z.number().finite(),
  tradings: z.array(tradingSchema).max(50),
  pracas: z.array(pracaSchema).max(50),
})

/** Carrega a config do simulador do workspace (ou null se ainda não salva). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!(await isFeatureEnabled(scope.workspaceId, 'simulador_cbot')))
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })

    const config = await db.simuladorConfig.findUnique({
      where: { workspaceId: scope.workspaceId },
    })

    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
      config: {
        fobbingsUsdTon: Number(config.fobbingsUsdTon),
        tradings: config.tradings,
        pracas: config.pracas,
      },
    })
  } catch (e: any) {
    console.error('[simulador-cbot/config GET]', e?.message || e)
    return NextResponse.json({ error: 'erro_interno' }, { status: 500 })
  }
}

/** Salva (upsert) a config do simulador do workspace. */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!(await isFeatureEnabled(scope.workspaceId, 'simulador_cbot')))
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })

    const body = await request.json()
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'dados_invalidos', detalhes: parsed.error.flatten() },
        { status: 422 },
      )
    }

    const { fobbingsUsdTon, tradings, pracas } = parsed.data

    const saved = await db.simuladorConfig.upsert({
      where: { workspaceId: scope.workspaceId },
      create: { workspaceId: scope.workspaceId, fobbingsUsdTon, tradings, pracas },
      update: { fobbingsUsdTon, tradings, pracas },
    })

    return NextResponse.json({
      config: {
        fobbingsUsdTon: Number(saved.fobbingsUsdTon),
        tradings: saved.tradings,
        pracas: saved.pracas,
      },
    })
  } catch (e: any) {
    console.error('[simulador-cbot/config PUT]', e?.message || e)
    return NextResponse.json({ error: 'erro_interno' }, { status: 500 })
  }
}
