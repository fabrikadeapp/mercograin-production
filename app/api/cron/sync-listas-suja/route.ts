/**
 * S4 M1 — Cron das listas oficiais de sanção (CNEP/CEIS/trabalho escravo).
 *
 * DESLIGADO até parser oficial estar implementado.
 * Retorna 410 Gone para o orquestrador pular sem alarmar.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      ok: false,
      desabilitado: true,
      motivo:
        'Sync de listas oficiais (trabalho escravo / CEIS / CNEP) não implementado.',
    },
    { status: 410 },
  )
}
