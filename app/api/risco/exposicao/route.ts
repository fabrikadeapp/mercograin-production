import { getScope } from '@/lib/auth/scope'
import { NextResponse } from 'next/server'
import { calcularExposicaoAtual, detectarBreaches } from '@/lib/risco/limites'

export async function GET() {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const exposicao = await calcularExposicaoAtual(scope.workspaceId)
  const breaches = await detectarBreaches(scope.workspaceId, exposicao)
  return NextResponse.json({ exposicao, breaches })
}
