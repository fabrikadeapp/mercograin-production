/**
 * POST /api/contratos/[id]/aditivos
 *
 * Cria um aditivo ao contrato base — modificação posterior sem rescisão.
 * Casos típicos:
 *   - 'volume'        → aumento ou redução de quantidade
 *   - 'prazo'         → prorrogação de dataFim
 *   - 'preco'         → ajuste comercial
 *   - 'cancelamento'  → rescisão formal (com multa, se houver)
 *   - 'outro'         → mudanças diversas (descrever na justificativa)
 *
 * Body:
 *   {
 *     tipo: 'volume'|'prazo'|'preco'|'cancelamento'|'outro',
 *     justificativa: string,
 *     mudancas: Record<string, { de: any; para: any }>,
 *     novaDataFim?: string  // ISO se tipo='prazo'
 *   }
 *
 * O aditivo nasce como Contrato novo:
 *   - numero novo
 *   - mesmo proposIdFk, clienteId, workspaceId do base
 *   - statusAssinatura='pendente'
 *   - aditivoBaseId aponta para o contrato base
 *   - aditivoTipo, aditivoMudancas, aditivoJustificativa preenchidos
 *
 * Audit log: 'contrato_aditivo_criado'.
 *
 * GET /api/contratos/[id]/aditivos
 * Lista todos os aditivos do contrato.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/next-number'
import { logAudit } from '@/lib/audit/log'
import { checkMutationLimit, rateLimited } from '@/lib/security/mutation-rate-limit'

const TIPOS_VALIDOS = ['volume', 'prazo', 'preco', 'cancelamento', 'outro'] as const

const schema = z.object({
  tipo: z.enum(TIPOS_VALIDOS),
  justificativa: z.string().min(5, 'Explique a razão do aditivo').max(2000),
  mudancas: z
    .record(
      z.string(),
      z.object({
        de: z.unknown().optional(),
        para: z.unknown().optional(),
      })
    )
    .optional(),
  novaDataFim: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const limit = checkMutationLimit('contrato.create', scope.userId)
    if (!limit.ok) return rateLimited(limit)

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const base = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!base) {
      return NextResponse.json({ error: 'Contrato base não encontrado' }, { status: 404 })
    }

    // Aditivos só fazem sentido em contratos assinados (com vigência ativa)
    // ou pelo menos com aceite. Cancelamento permite mesmo em pendente.
    if (data.tipo !== 'cancelamento' && base.statusAssinatura === 'pendente') {
      return NextResponse.json(
        { error: 'Aditivo só pode ser criado em contrato já aceito/assinado. Use cancelamento se for desfazer.' },
        { status: 409 }
      )
    }

    let novaDataFim: Date | null = base.dataFim ?? null
    if (data.novaDataFim) {
      novaDataFim = new Date(data.novaDataFim)
      if (isNaN(novaDataFim.getTime())) {
        return NextResponse.json({ error: 'novaDataFim inválida' }, { status: 400 })
      }
    }

    const numeroGerado = await nextNumber(scope.workspaceId, 'contrato')

    const aditivo = await db.contrato.create({
      data: {
        numero: numeroGerado,
        proposIdFk: base.proposIdFk,
        clienteId: base.clienteId,
        workspaceId: scope.workspaceId,
        dataInicio: new Date(),
        dataFim: novaDataFim,
        statusAssinatura: 'pendente',
        modalidade: base.modalidade,
        gerenteContaId: base.gerenteContaId,
        vendedorId: base.vendedorId,
        aditivoBaseId: base.id,
        aditivoTipo: data.tipo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aditivoMudancas: (data.mudancas ?? null) as any,
        aditivoJustificativa: data.justificativa,
      },
      select: { id: true, numero: true, aditivoTipo: true, criadoEm: true },
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'contrato_aditivo_criado',
      entidade: 'contrato',
      entidadeId: aditivo.id,
      mudancas: {
        numero: aditivo.numero,
        contratoBaseId: base.id,
        contratoBaseNumero: base.numero,
        tipo: data.tipo,
        justificativa: data.justificativa,
        mudancasItens: data.mudancas ?? null,
      },
    }).catch(() => undefined)

    return NextResponse.json(aditivo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Aditivo error:', error)
    return NextResponse.json({ error: 'Erro ao criar aditivo' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const base = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true, numero: true },
    })
    if (!base) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    const aditivos = await db.contrato.findMany({
      where: {
        aditivoBaseId: base.id,
        ...scope.whereOwn(),
      },
      select: {
        id: true,
        numero: true,
        aditivoTipo: true,
        aditivoJustificativa: true,
        aditivoMudancas: true,
        statusAssinatura: true,
        dataInicio: true,
        dataFim: true,
        criadoEm: true,
        assinadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    })

    return NextResponse.json({
      contratoBase: base,
      aditivos,
    })
  } catch (error) {
    console.error('Lista aditivos error:', error)
    return NextResponse.json({ error: 'Erro ao listar aditivos' }, { status: 500 })
  }
}
