import { NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { isValidCNPJ } from '@/lib/br/documento'
import { consultarCnpj } from '@/lib/br/receitaws'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

/**
 * GET /api/br/cnpj/{cnpj}
 *
 * Consulta dados públicos de um CNPJ (BrasilAPI primário, ReceitaWS fallback).
 * Requer autenticação. Rate-limited em 30 consultas/hora por IP.
 */
export async function GET(
  req: Request,
  { params }: { params: { cnpj: string } }
) {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const cnpj = params.cnpj.replace(/\D/g, '')
  if (!isValidCNPJ(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = rateLimit(`cnpj:${ip}`, 30, 60 * 60 * 1000) // 30/h por IP
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Muitas consultas. Tente em 1h' },
      { status: 429 }
    )
  }

  const data = await consultarCnpj(cnpj)
  if (!data) {
    return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 })
  }
  return NextResponse.json(data)
}
