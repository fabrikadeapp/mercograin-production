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
import { notificarPorWhats } from '@/lib/whatsapp/notificar'
import { whatsContratoGerado } from '@/lib/whatsapp/templates'

export interface AutoCriarContratoArgs {
  propostaId: string
  workspaceId: string
  userId: string
  /**
   * Opcional. Quando informado, dispara notificação WhatsApp pro cliente
   * com link do portal. Caller HTTP deve passar o origin da request.
   */
  origin?: string
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
        numero: true,
        tipo: true,
        clienteId: true,
        workspaceId: true,
        valorTotal: true,
        cliente: { select: { nome: true, whatsapp: true } },
        workspace: { select: { name: true, slug: true } },
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

    // Notifica cliente por WhatsApp (best-effort)
    if (args.origin && proposta.cliente?.whatsapp && proposta.workspace?.slug) {
      const valorFmt = Number(proposta.valorTotal).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      const portalUrl = `${args.origin}/portal/${proposta.workspace.slug}/contratos/${contrato.id}`
      const texto = whatsContratoGerado({
        clienteNome: proposta.cliente.nome,
        workspaceNome: proposta.workspace.name,
        contratoNumero: contrato.numero,
        propostaNumero: proposta.numero,
        valorFormatado: valorFmt,
        portalUrl,
      })
      void notificarPorWhats({
        workspaceId: args.workspaceId,
        para: proposta.cliente.whatsapp,
        texto,
        categoria: 'contrato_gerado_cliente',
        meta: {
          propostaId: proposta.id,
          contratoId: contrato.id,
          contratoNumero: contrato.numero,
        },
      })
    }

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
