/**
 * POST /api/propostas/[id]/share
 * Gera link público assinado do PDF da proposta. TTL default = validadeEm
 * da proposta. Não persiste o token — ele é auto-validável via HMAC.
 *
 * Resposta:
 *   { url: string, token: string, expiraEm: ISO }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { gerarTokenProposta } from '@/lib/propostas/share-token'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true, numero: true, validadeEm: true },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    // TTL = validadeEm da proposta (cap em +60 dias se proposta já vencida ou validade futura distante)
    const agora = Date.now()
    const validade = proposta.validadeEm.getTime()
    const maxTTL = 60 * 86_400_000
    const expiraEm =
      validade > agora && validade - agora < maxTTL
        ? proposta.validadeEm
        : new Date(agora + 30 * 86_400_000)

    const { token } = gerarTokenProposta(proposta.id, { expiraEm })

    const origin = request.headers.get('origin') ?? request.nextUrl.origin
    const url = `${origin}/api/propostas/share/${token}`

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'share',
      entidade: 'proposta',
      entidadeId: proposta.id,
      mudancas: { numero: proposta.numero, expiraEm: expiraEm.toISOString() },
    })

    return NextResponse.json({ url, token, expiraEm: expiraEm.toISOString() })
  } catch (error) {
    console.error('Generate share link error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar link compartilhável' },
      { status: 500 }
    )
  }
}
