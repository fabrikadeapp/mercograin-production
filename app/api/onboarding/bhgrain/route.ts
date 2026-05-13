/**
 * GET/POST /api/onboarding/bhgrain
 *
 * Step de onboarding BH Grain — meta mensal + perfis comerciais.
 * Auth: usuário logado precisa ser owner ou admin do workspace ativo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isCommercialRole } from '@/lib/bhgrain/permissions'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function periodoCorrente(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function requireOwnerOrAdmin(searchParams?: URLSearchParams) {
  const scope = await requireScope(searchParams)
  if (!['owner', 'admin'].includes(scope.workspaceRole) && !scope.isAdmin) {
    throw new Error('Acesso negado')
  }
  return scope
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireOwnerOrAdmin(new URL(request.url).searchParams)
    const [members, meta] = await Promise.all([
      db.workspaceMember.findMany({
        where: { workspaceId: scope.workspaceId, status: 'active' },
        select: { id: true, email: true, role: true, commercialRole: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.metaComercial.findFirst({
        where: { workspaceId: scope.workspaceId, periodo: periodoCorrente(), userId: null, commodity: null },
        select: { valorMeta: true },
      }),
    ])
    return NextResponse.json({
      members,
      metaAtual: meta ? Number(meta.valorMeta) : null,
      periodo: periodoCorrente(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: msg.includes('Acesso') || msg.includes('autoriz') ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireOwnerOrAdmin()
    const fd = await request.formData()
    const periodo = String(fd.get('periodo') ?? periodoCorrente())
    if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('Período inválido')

    let metaSet = false
    const metaRaw = String(fd.get('meta') ?? '').trim()
    if (metaRaw) {
      const valor = Number(metaRaw.replace(',', '.'))
      if (Number.isFinite(valor) && valor > 0) {
        await db.metaComercial.upsert({
          where: {
            workspaceId_periodo_userId_commodity: {
              workspaceId: scope.workspaceId,
              periodo,
              userId: null as unknown as string,
              commodity: null as unknown as string,
            },
          },
          create: {
            workspaceId: scope.workspaceId,
            periodo,
            userId: null,
            commodity: null,
            valorMeta: new Prisma.Decimal(valor),
            moeda: 'BRL',
          },
          update: { valorMeta: new Prisma.Decimal(valor) },
        })
        metaSet = true
      }
    }

    // Coleta role.<memberId> entries
    let rolesSet = 0
    const memberRolePromises: Promise<unknown>[] = []
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith('role.')) continue
      const memberId = k.slice('role.'.length)
      const role = String(v).trim()
      const commercialRole = isCommercialRole(role) ? role : null
      memberRolePromises.push(
        db.workspaceMember
          .updateMany({
            where: { id: memberId, workspaceId: scope.workspaceId },
            data: { commercialRole },
          })
          .then((r) => {
            if (r.count > 0) rolesSet++
          })
      )
    }
    await Promise.all(memberRolePromises)

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'Onboarding BH Grain configurado',
        entidade: 'Workspace',
        entidadeId: scope.workspaceId,
        workspaceId: scope.workspaceId,
        mudancas: { metaSet, rolesSet, periodo },
      },
    })

    return NextResponse.json({ ok: true, metaSet, rolesSet })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
