/**
 * S5 M9 — Cron: sincronização de áreas protegidas (TI/UC/embargos).
 *
 * DESLIGADO até a feature `eudr` ter integração real (FUNAI/ICMBio/IBAMA).
 * Retorna 410 Gone para o orquestrador pular sem alarmar.
 *
 * Quando reativar:
 *   - Implementar fetchFunai/fetchIcmbio/fetchIbama em lib/compliance/sync-fontes.ts
 *   - Reintroduzir loop de upsert em db.areaProtegida
 *   - Remover este short-circuit
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      ok: false,
      desabilitado: true,
      motivo:
        'Sync de áreas protegidas (FUNAI/ICMBio/IBAMA) não implementado. ' +
        'Feature eudr off até integração real.',
    },
    { status: 410 },
  )
}
