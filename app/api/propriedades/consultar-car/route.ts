/**
 * S4 M1 — Consulta CAR via SICAR adapter (sem persistir).
 * POST /api/propriedades/consultar-car  { car: 'RS-...' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { consultarCAR } from '@/lib/br/sicar'
import { isValidCarFormat } from '@/lib/br/car'

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const car = String(body?.car || '')
  if (!isValidCarFormat(car)) {
    return NextResponse.json({ error: 'CAR em formato inválido' }, { status: 400 })
  }
  const resultado = await consultarCAR(car)
  return NextResponse.json(resultado)
}
