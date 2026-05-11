import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { encryptApiKey, isValidOpenAIKey, maskKey } from '@/lib/ai/key-vault'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function canManage(role: string | undefined, isAdmin: boolean) {
  if (isAdmin) return true
  return role === 'owner' || role === 'admin'
}

async function loadAiState(workspaceId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      aiMode: true,
      aiKeyEncrypted: true,
      aiModel: true,
      subscription: { select: { plan: true } },
    },
  })
  if (!ws) return null

  const planSlug = ws.subscription?.plan ?? null
  const plan = planSlug
    ? await db.plan.findUnique({
        where: { slug: planSlug },
        select: { aiAccess: true, aiMonthlyMessages: true },
      })
    : null

  return {
    aiMode: ws.aiMode,
    aiKeyEncrypted: ws.aiKeyEncrypted,
    aiModel: ws.aiModel,
    plan: {
      aiAccess: plan?.aiAccess ?? 'none',
      aiMonthlyMessages: plan?.aiMonthlyMessages ?? 0,
    },
  }
}

/**
 * GET — estado atual da configuração AI do workspace.
 * Retorna: mode, model, hasKey, plan.aiAccess, plan.aiMonthlyMessages.
 * Nunca expõe a chave em si — só uma máscara.
 */
export async function GET() {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const ws = await loadAiState(scope.workspaceId)
    if (!ws) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({
      mode: ws.aiMode,
      model: ws.aiModel,
      hasKey: !!ws.aiKeyEncrypted,
      keyMask: ws.aiKeyEncrypted ? maskKey('sk-proj-' + ws.aiKeyEncrypted.slice(0, 10)) : null,
      plan: ws.plan,
    })
  } catch (e: any) {
    console.error('[workspaces/ai GET]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

/**
 * PATCH — atualiza configuração AI do workspace.
 * Body: { mode?: 'managed'|'byok', model?: string, apiKey?: string }
 *
 * Regras:
 *   - apenas owner/admin do workspace
 *   - mode='byok' só se plan.aiAccess === 'byok_allowed'
 *   - se enviar apiKey, valida formato + cripta + salva
 */
export async function PATCH(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { mode, model, apiKey } = body as {
      mode?: string
      model?: string
      apiKey?: string
    }

    const ws = await loadAiState(scope.workspaceId)
    if (!ws) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const aiAccess = ws.plan.aiAccess
    if (aiAccess === 'none') {
      return NextResponse.json(
        { error: 'plan_no_ai', message: 'Seu plano não inclui o agente AI.' },
        { status: 403 },
      )
    }

    const data: Record<string, unknown> = {}

    if (mode !== undefined) {
      if (mode !== 'managed' && mode !== 'byok') {
        return NextResponse.json({ error: 'invalid_mode' }, { status: 400 })
      }
      if (mode === 'byok' && aiAccess !== 'byok_allowed') {
        return NextResponse.json(
          { error: 'plan_no_byok', message: 'BYOK disponível apenas no plano Enterprise.' },
          { status: 403 },
        )
      }
      data.aiMode = mode
    }

    if (model !== undefined) {
      // Whitelist mínima de modelos válidos para evitar abuso
      const allowed = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
      if (!allowed.includes(model)) {
        return NextResponse.json({ error: 'invalid_model', allowed }, { status: 400 })
      }
      data.aiModel = model
    }

    if (apiKey !== undefined && apiKey !== '') {
      if (!isValidOpenAIKey(apiKey)) {
        return NextResponse.json({ error: 'invalid_key' }, { status: 400 })
      }
      const enc = encryptApiKey(apiKey)
      data.aiKeyEncrypted = enc.encrypted
      data.aiKeyIv = enc.iv
      data.aiKeyTag = enc.tag
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'no_changes' }, { status: 400 })
    }

    await db.workspace.update({
      where: { id: scope.workspaceId },
      data,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[workspaces/ai PATCH]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

/**
 * DELETE — remove a chave BYOK (zera campos criptografados).
 * Mantém o modo no que estiver — o resolver de cliente cai em 'no_key' se mode='byok'.
 */
export async function DELETE() {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    await db.workspace.update({
      where: { id: scope.workspaceId },
      data: {
        aiKeyEncrypted: null,
        aiKeyIv: null,
        aiKeyTag: null,
        aiMode: 'managed',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[workspaces/ai DELETE]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
