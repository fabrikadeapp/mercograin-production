/**
 * S5 M9 — POST /api/propriedades/[id]/consultar-mapbiomas
 *
 * Consulta alertas MapBiomas para a propriedade, persiste em alertaDesmatamento.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { consultarMapBiomas } from '@/lib/compliance/mapbiomas'
import { logAudit } from '@/lib/audit/log'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const prop = await db.propriedadeRural.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!prop) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  // EUDR cutoff: 31/12/2020
  const cutoff = new Date('2020-12-31T00:00:00Z')

  const resultado = await consultarMapBiomas({
    car: prop.car || undefined,
    geoJson: prop.geoJson || undefined,
    desde: cutoff,
  })

  await db.propriedadeRural.update({
    where: { id: prop.id },
    data: { alertaDesmatamento: resultado as any },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'propriedade_rural',
    entidadeId: prop.id,
    mudancas: { mapbiomas_total: resultado.totalAlertas, fonte: resultado.fonte },
  })

  return NextResponse.json(resultado)
}
