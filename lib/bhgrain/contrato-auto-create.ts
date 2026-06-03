/**
 * Cria contrato automaticamente a partir de uma proposta aprovada.
 *
 * Chamado pelo trigger pós-aprovação em
 *   app/api/bhgrain/propostas/[id]/aprovar/route.ts
 *
 * Idempotente: se já existe contrato pra essa proposta, retorna o existente.
 * Best-effort: erros não propagam — log + return null, aprovação não regride.
 */

import { db } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/next-number'
import { logAudit } from '@/lib/audit/log'

export interface AutoCriarContratoArgs {
  propostaId: string
  workspaceId: string
  userId: string
}

export interface AutoCriarContratoResult {
  contratoId: string
  numero: string
  novo: boolean
  templateId: string | null
}

export async function criarContratoAutoFromProposta(
  args: AutoCriarContratoArgs
): Promise<AutoCriarContratoResult | null> {
  try {
    // 1. Já existe contrato para essa proposta? Idempotência.
    const existente = await db.contrato.findFirst({
      where: { proposIdFk: args.propostaId, workspaceId: args.workspaceId },
      select: { id: true, numero: true },
    })
    if (existente) {
      return {
        contratoId: existente.id,
        numero: existente.numero,
        novo: false,
        templateId: null,
      }
    }

    // 2. Busca a proposta + cliente + tipo
    const proposta = await db.proposta.findUnique({
      where: { id: args.propostaId },
      select: {
        id: true,
        tipo: true,
        clienteId: true,
        workspaceId: true,
      },
    })
    if (!proposta) return null
    if (proposta.workspaceId !== args.workspaceId) return null

    // 3. Resolve template default por tipo (venda/compra) — ou primeiro ativo
    const tipoTemplate = proposta.tipo === 'compra' ? 'compra' : 'venda'
    const templateDefault = await db.contratoTemplate.findFirst({
      where: {
        workspaceId: args.workspaceId,
        ativo: true,
        OR: [{ isDefault: true, tipo: tipoTemplate }, { tipo: tipoTemplate }],
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    })

    // 4. Cria contrato (statusAprovacao 'aprovado' — aprovação da proposta JÁ foi feita)
    const numeroGerado = await nextNumber(args.workspaceId, 'contrato')

    const contrato = await db.contrato.create({
      data: {
        proposIdFk: proposta.id,
        clienteId: proposta.clienteId,
        numero: numeroGerado,
        workspaceId: args.workspaceId,
        dataInicio: new Date(),
        statusAssinatura: 'pendente',
        statusAprovacao: 'aprovado',
      },
      select: { id: true, numero: true },
    })

    await logAudit({
      userId: args.userId,
      workspaceId: args.workspaceId,
      acao: 'auto_create_from_proposta',
      entidade: 'contrato',
      entidadeId: contrato.id,
      mudancas: {
        numero: contrato.numero,
        propostaId: proposta.id,
        templateId: templateDefault?.id ?? null,
        origem: 'aprovacao_automatica',
      },
    })

    return {
      contratoId: contrato.id,
      numero: contrato.numero,
      novo: true,
      templateId: templateDefault?.id ?? null,
    }
  } catch (err) {
    console.error('[criarContratoAutoFromProposta] best-effort falhou:', err)
    return null
  }
}
