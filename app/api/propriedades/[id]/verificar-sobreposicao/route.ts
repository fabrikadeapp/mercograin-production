/**
 * S5 M9 — POST /api/propriedades/[id]/verificar-sobreposicao
 *
 * Calcula sobreposição da propriedade com áreas protegidas (TI/UC/embargo)
 * e atualiza os flags sobreposicaoTI/sobreposicaoUC/embargoIbama no registro.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { verificarSobreposicao } from '@/lib/compliance/sobreposicao'
import { logAudit } from '@/lib/audit/log'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const prop = await db.propriedadeRural.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!prop) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (!prop.geoJson) {
    return NextResponse.json(
      { error: 'Propriedade sem georreferenciamento (geoJson)' },
      { status: 400 },
    )
  }

  const resultado = await verificarSobreposicao({
    geoJson: prop.geoJson,
    uf: prop.uf || undefined,
  })

  const sobreposicaoTI = resultado.areas.some((a) => a.tipo === 'terra_indigena')
  const sobreposicaoUC = resultado.areas.some((a) => a.tipo === 'unidade_conservacao')
  const embargoIbama = resultado.areas.some((a) => a.tipo === 'embargo_ibama')

  await db.propriedadeRural.update({
    where: { id: prop.id },
    data: {
      sobreposicaoTI,
      sobreposicaoUC,
      embargoIbama,
      embargoVerificadoEm: new Date(),
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'propriedade_rural',
    entidadeId: prop.id,
    mudancas: { sobreposicaoTI, sobreposicaoUC, embargoIbama, areas: resultado.areas.length },
  })

  return NextResponse.json(resultado)
}
