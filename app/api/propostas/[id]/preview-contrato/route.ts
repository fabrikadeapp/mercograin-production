/**
 * GET /api/propostas/[id]/preview-contrato
 *
 * Retorna HTML do contrato que SERIA gerado se a proposta fosse aprovada.
 * Não cria nada. Usado pelo modal "Aprovar com preview".
 *
 * Resposta:
 *   { html: string, templateNome: string | null, variavelFaltando: string[] }
 *
 * Se nenhum template existir, retorna html simples com aviso.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  resolveContent,
  resolveVariable,
  extractVariables,
  type RenderContext,
  type ProductInfo,
} from '@/lib/contratos/render-template'
import { tiptapJsonToHtml } from '@/lib/contratos/tiptap-to-html'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
      },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    // Template default por tipo
    const tipoTemplate = proposta.tipo === 'compra' ? 'compra' : 'venda'
    const template = await db.contratoTemplate.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        ativo: true,
        OR: [{ isDefault: true, tipo: tipoTemplate }, { tipo: tipoTemplate }],
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    if (!template) {
      return NextResponse.json({
        html: `<div style="padding:24px;border:1px dashed #ccc;border-radius:8px;color:#666;">
          <h3 style="margin-top:0">Nenhum template de contrato encontrado</h3>
          <p>Crie um template em <b>/contratos/templates</b> antes de aprovar.</p>
          <p>Ao aprovar agora, o contrato será criado <i>vazio</i> (sem conteúdo de template).</p>
        </div>`,
        templateNome: null,
        variavelFaltando: [],
        templateExiste: false,
      })
    }

    // DadosEmpresa do workspace
    const empresa = await db.dadosEmpresa.findFirst({
      where: { workspaceId: scope.workspaceId },
    })

    // Primeiro grão da proposta
    const graos = Array.isArray(proposta.graos) ? (proposta.graos as Array<Record<string, unknown>>) : []
    const primeiro = graos[0]
    const produto: ProductInfo | undefined = primeiro
      ? {
          grao: String(primeiro.grao ?? ''),
          quantidade: Number(primeiro.quantidade ?? 0),
          preco: Number(primeiro.preco ?? 0),
          subtotal: Number(primeiro.subtotal ?? 0),
          unidade: 't',
        }
      : undefined

    // Monta Contrato "virtual" (não persiste) — preenche campos que resolveVariable usa
    const contratoVirtual = {
      id: 'preview',
      numero: 'PREVIEW',
      clienteId: proposta.clienteId,
      proposIdFk: proposta.id,
      workspaceId: scope.workspaceId,
      dataInicio: new Date(),
      dataFim: proposta.validadeEm,
      statusAssinatura: 'pendente',
      statusAprovacao: 'aprovado',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      tipo: proposta.tipo,
      modalidade: 'fixo',
      formaPagamento: null,
      prazoPagamentoDias: null,
      localEntrega: proposta.localEntrega ?? null,
      pdfUrl: null,
      pdfHash: null,
      pdfHashedAt: null,
      gerenteContaId: proposta.gerenteContaId,
      vendedorId: proposta.vendedorId,
      proposta,
    } as unknown as RenderContext['contrato']

    const ctx: RenderContext = {
      empresa,
      cliente: proposta.cliente,
      contrato: contratoVirtual,
      produto,
    }

    const resolvedJson = resolveContent(template.contentJson, ctx)
    const html = tiptapJsonToHtml(resolvedJson)

    // Detecta variáveis cuja resolução voltou vazia/placeholder
    const todasVars = extractVariables(template.contentJson)
    const variavelFaltando: string[] = []
    for (const v of todasVars) {
      const valor = resolveVariable(v, ctx)
      if (!valor || valor === '—' || valor.trim() === '') {
        variavelFaltando.push(v)
      }
    }

    return NextResponse.json({
      html,
      templateNome: template.nome,
      templateId: template.id,
      templateExiste: true,
      variavelFaltando,
    })
  } catch (error) {
    console.error('Preview contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar preview', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
