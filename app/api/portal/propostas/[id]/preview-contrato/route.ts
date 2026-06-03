/**
 * GET /api/portal/propostas/[id]/preview-contrato
 *
 * Versão do preview do contrato acessível pelo cliente logado no portal.
 * Mesma lógica do endpoint interno em /api/propostas/[id]/preview-contrato,
 * mas autenticada por requirePortal() em vez de getScope().
 *
 * Resposta: { html, templateNome, templateExiste, variavelFaltando }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
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
    const sess = await requirePortal()
    if (!sess) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: {
        id: params.id,
        clienteId: sess.clienteId,
        workspaceId: sess.workspaceId,
      },
      include: { cliente: true },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const tipoTemplate = proposta.tipo === 'compra' ? 'compra' : 'venda'
    const template = await db.contratoTemplate.findFirst({
      where: {
        workspaceId: sess.workspaceId,
        ativo: true,
        OR: [{ isDefault: true, tipo: tipoTemplate }, { tipo: tipoTemplate }],
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    if (!template) {
      return NextResponse.json({
        html: `<div style="padding:24px;border:1px dashed #ccc;border-radius:8px;color:#666;">
          <h3 style="margin-top:0">Sem modelo de contrato disponível</h3>
          <p>A corretora ainda não configurou um modelo. Ao aceitar a proposta,
          ela vai entrar em contato para finalizar o contrato.</p>
        </div>`,
        templateNome: null,
        templateExiste: false,
        variavelFaltando: [],
      })
    }

    const empresa = await db.dadosEmpresa.findFirst({
      where: { workspaceId: sess.workspaceId },
    })

    const graos = Array.isArray(proposta.graos)
      ? (proposta.graos as Array<Record<string, unknown>>)
      : []
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

    const contratoVirtual = {
      id: 'preview-portal',
      numero: 'PREVIEW',
      clienteId: proposta.clienteId,
      proposIdFk: proposta.id,
      workspaceId: sess.workspaceId,
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
      templateExiste: true,
      variavelFaltando,
    })
  } catch (error) {
    console.error('Portal preview contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar preview do contrato' },
      { status: 500 }
    )
  }
}
