/**
 * POST /api/propostas/[id]/clonar
 *
 * Cria uma nova proposta baseada numa existente — útil para:
 *   - Reenviar proposta vencida (nova validade)
 *   - Duplicar para outro cliente (com ajuste opcional)
 *
 * Body (todos opcionais):
 *   {
 *     clienteId?: string;         // se mudar, vai pra outro cliente
 *     validadeEm?: string;        // ISO date; default = +30 dias
 *     ajustePrecoPct?: number;    // ex: 1.05 → 5% mais caro
 *     novosGraos?: GraoItem[];    // override total dos grãos
 *   }
 *
 * A nova proposta nasce:
 *   - status='rascunho' (sempre)
 *   - canalAutorizacao herdado
 *   - numero novo gerado
 *   - referência ao original em observacoes (audit trail)
 *
 * Audit log: 'proposta_clonada' com propostaOriginalId + ajustes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/next-number'
import { logAudit } from '@/lib/audit/log'
import { checkMutationLimit, rateLimited } from '@/lib/security/mutation-rate-limit'
import { normalizarGraos } from '@/lib/propostas/grao-item'
import { PROPOSTA_STATUS } from '@/lib/propostas/status'

const schema = z.object({
  clienteId: z.string().optional(),
  validadeEm: z.string().optional(),
  ajustePrecoPct: z.number().positive().max(10).optional(),
  novosGraos: z
    .array(
      z.object({
        grao: z.string(),
        quantidade: z.number().positive(),
        preco: z.number().positive(),
        subtotal: z.number().positive(),
      })
    )
    .optional(),
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

    const limit = checkMutationLimit('proposta.create', scope.userId)
    if (!limit.ok) return rateLimited(limit)

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const original = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!original) {
      return NextResponse.json({ error: 'Proposta original não encontrada' }, { status: 404 })
    }

    // Define o cliente final (mesmo ou alvo)
    const clienteIdFinal = data.clienteId ?? original.clienteId
    if (data.clienteId && data.clienteId !== original.clienteId) {
      // Valida que o cliente alvo pertence ao mesmo workspace
      const clienteAlvo = await db.cliente.findFirst({
        where: { id: clienteIdFinal, ...scope.whereOwn() },
        select: { id: true },
      })
      if (!clienteAlvo) {
        return NextResponse.json(
          { error: 'Cliente destino não encontrado' },
          { status: 404 }
        )
      }
    }

    // Aplica ajustes nos grãos
    const graosBase = data.novosGraos ?? normalizarGraos(original.graos)
    const ajuste = data.ajustePrecoPct ?? 1
    const graosFinais = graosBase.map((g) => {
      const preco = Math.round(g.preco * ajuste * 100) / 100
      const subtotal = Math.round(g.quantidade * preco * 100) / 100
      return {
        grao: g.grao,
        quantidade: g.quantidade,
        preco,
        subtotal,
      }
    })
    const valorTotal = graosFinais.reduce((acc, g) => acc + g.subtotal, 0)

    // Define validade: passada ou +30 dias
    let validadeEm: Date
    if (data.validadeEm) {
      validadeEm = new Date(data.validadeEm)
      if (isNaN(validadeEm.getTime())) {
        return NextResponse.json({ error: 'validadeEm inválida' }, { status: 400 })
      }
    } else {
      validadeEm = new Date(Date.now() + 30 * 86_400_000)
    }

    // Membership para vendedor padrão
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: scope.userId },
      select: { id: true },
    })

    const numeroGerado = await nextNumber(scope.workspaceId, 'proposta')

    const nova = await db.proposta.create({
      data: {
        numero: numeroGerado,
        clienteId: clienteIdFinal,
        workspaceId: scope.workspaceId,
        tipo: original.tipo,
        graos: graosFinais,
        valorTotal: String(valorTotal),
        status: PROPOSTA_STATUS.RASCUNHO,
        descricao: original.descricao,
        validadeEm,
        validadeCotacao: validadeEm,
        vendedorId: member?.id ?? null,
        gerenteContaId: original.gerenteContaId ?? member?.id ?? null,
        canalAutorizacao: original.canalAutorizacao,
        origem: original.origem,
        localEntrega: original.localEntrega,
        observacoes: [
          original.observacoes,
          `[clonada de ${original.numero}${data.ajustePrecoPct ? ` · ajuste preço ${(data.ajustePrecoPct * 100 - 100).toFixed(1)}%` : ''}]`,
        ]
          .filter(Boolean)
          .join('\n')
          .trim(),
        propostaOriginalId: original.id,
      },
      include: { cliente: true },
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'proposta_clonada',
      entidade: 'proposta',
      entidadeId: nova.id,
      mudancas: {
        propostaOriginalId: original.id,
        numeroOriginal: original.numero,
        numeroNovo: nova.numero,
        ajustePrecoPct: data.ajustePrecoPct ?? null,
        clienteMudou: data.clienteId !== original.clienteId,
        valorTotal,
      },
    })

    return NextResponse.json(nova, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Clonar proposta error:', error)
    return NextResponse.json({ error: 'Erro ao clonar proposta' }, { status: 500 })
  }
}
