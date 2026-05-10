/**
 * POST /api/contratos/templates/[id]/versoes/[versao]/reverter
 * Reverte o template para o conteúdo de uma versão histórica.
 * Cria automaticamente uma nova versão snapshot ANTES de aplicar o revert
 * (audit trail), depois sobrescreve contentJson + variaveis com o histórico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; versao: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const versaoAlvo = parseInt(params.versao, 10)
  if (!Number.isFinite(versaoAlvo) || versaoAlvo < 1) {
    return NextResponse.json({ error: 'versao_invalida' }, { status: 400 })
  }

  const tpl = await db.contratoTemplate.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const alvo = await db.contratoTemplateVersao.findUnique({
    where: { templateId_versao: { templateId: tpl.id, versao: versaoAlvo } },
  })
  if (!alvo) {
    return NextResponse.json({ error: 'versao_nao_existe' }, { status: 404 })
  }

  const novaVersao = (tpl.versao ?? 1) + 1
  await db.$transaction(async (tx) => {
    // Snapshot do estado atual antes de reverter
    await tx.contratoTemplateVersao.create({
      data: {
        templateId: tpl.id,
        versao: novaVersao,
        contentJson: tpl.contentJson as any,
        variaveis: (tpl.variaveis as any) ?? undefined,
        createdBy: scope.userId,
        comentario: `Auto-snapshot antes de reverter para v${versaoAlvo}`,
      },
    })
    await tx.contratoTemplate.update({
      where: { id: tpl.id },
      data: {
        versao: novaVersao,
        contentJson: alvo.contentJson as any,
        variaveis: (alvo.variaveis as any) ?? undefined,
      },
    })
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'contrato_template',
    entidadeId: tpl.id,
    mudancas: { revertido_para_versao: versaoAlvo, nova_versao_marca: novaVersao },
  })

  return NextResponse.json({ ok: true, novaVersao, revertidoPara: versaoAlvo })
}
