/**
 * POST /api/admin/seed-templates
 *
 * TEMPORARIO: cria 2 templates default (venda + compra) num workspace
 * para destravar o fluxo de envio para assinatura.
 *
 * Auth: Bearer ${CRON_SECRET}
 * Body: { workspaceSlug: string }
 *
 * REMOVER APOS USO.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  workspaceSlug: z.string(),
})

// Função utilitária para criar um nó de paragrafo TipTap.
// Tipagem ampla (qualquer Node) — esse arquivo é descartável.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any

function p(...children: Node[]): Node {
  return {
    type: 'paragraph',
    content: children.map((c) =>
      typeof c === 'string' ? { type: 'text', text: c } : c
    ),
  }
}

function bold(text: string): Node {
  return { type: 'text', text, marks: [{ type: 'bold' }] }
}

function h(level: number, text: string): Node {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

// ── Conteúdo do contrato de VENDA ──
function buildContentVenda(): Node {
  return {
    type: 'doc',
    content: [
      h(1, 'CONTRATO DE COMPRA E VENDA DE GRÃOS'),
      p('Contrato nº ', bold('{{contrato.numero}}')),
      p(),
      h(2, 'VENDEDOR'),
      p(bold('{{empresa.razaoSocial}}'), ', inscrita no CNPJ ', bold('{{empresa.cnpj}}'), ', com sede em {{empresa.endereco}}, {{empresa.cidade}}/{{empresa.uf}}.'),
      p(),
      h(2, 'COMPRADOR'),
      p(bold('{{cliente.nome}}'), ', inscrito no CNPJ ', bold('{{cliente.cnpj}}'), ', com endereço em {{cliente.endereco}}.'),
      p(),
      h(2, 'OBJETO'),
      p('O VENDEDOR compromete-se a entregar ao COMPRADOR a quantidade de ', bold('{{produto.quantidade}} {{produto.unidade}}'), ' de ', bold('{{produto.grao}}'), ', ao preço unitário de R$ {{produto.preco}}.'),
      p(),
      h(2, 'VALOR TOTAL'),
      p('O valor total do presente contrato é de ', bold('R$ {{contrato.valorTotal}}'), ' ({{contrato.valorExtenso}}).'),
      p(),
      h(2, 'PRAZO DE ENTREGA'),
      p('A entrega da mercadoria deverá ocorrer entre ', bold('{{contrato.dataInicio}}'), ' e ', bold('{{contrato.dataFim}}'), '.'),
      p(),
      h(2, 'CONDIÇÕES DE PAGAMENTO'),
      p('O pagamento será realizado conforme acordado entre as partes, mediante apresentação dos documentos fiscais correspondentes.'),
      p(),
      h(2, 'QUALIDADE E CLASSIFICAÇÃO'),
      p('A mercadoria deverá atender aos padrões mínimos de qualidade vigentes para a commodity, conforme normas do Ministério da Agricultura.'),
      p(),
      h(2, 'FORO'),
      p('Fica eleito o foro da comarca de {{empresa.cidade}}/{{empresa.uf}} para dirimir quaisquer questões oriundas deste contrato.'),
      p(),
      p('{{hoje.cidade}}, {{hoje.dataLonga}}.'),
      p(),
      p(),
      p('_____________________________________'),
      p(bold('{{empresa.razaoSocial}}')),
      p('(VENDEDOR)'),
      p(),
      p('_____________________________________'),
      p(bold('{{cliente.nome}}')),
      p('(COMPRADOR)'),
    ],
  }
}

// ── Conteúdo do contrato de COMPRA ──
function buildContentCompra(): Node {
  return {
    type: 'doc',
    content: [
      h(1, 'CONTRATO DE COMPRA E VENDA DE GRÃOS'),
      p('Contrato nº ', bold('{{contrato.numero}}')),
      p(),
      h(2, 'COMPRADOR'),
      p(bold('{{empresa.razaoSocial}}'), ', inscrita no CNPJ ', bold('{{empresa.cnpj}}'), ', com sede em {{empresa.endereco}}, {{empresa.cidade}}/{{empresa.uf}}.'),
      p(),
      h(2, 'VENDEDOR'),
      p(bold('{{cliente.nome}}'), ', inscrito no CNPJ ', bold('{{cliente.cnpj}}'), ', com endereço em {{cliente.endereco}}.'),
      p(),
      h(2, 'OBJETO'),
      p('O VENDEDOR compromete-se a entregar ao COMPRADOR a quantidade de ', bold('{{produto.quantidade}} {{produto.unidade}}'), ' de ', bold('{{produto.grao}}'), ', ao preço unitário de R$ {{produto.preco}}.'),
      p(),
      h(2, 'VALOR TOTAL'),
      p('O valor total do presente contrato é de ', bold('R$ {{contrato.valorTotal}}'), ' ({{contrato.valorExtenso}}).'),
      p(),
      h(2, 'PRAZO DE ENTREGA'),
      p('A entrega da mercadoria deverá ocorrer entre ', bold('{{contrato.dataInicio}}'), ' e ', bold('{{contrato.dataFim}}'), '.'),
      p(),
      h(2, 'CONDIÇÕES DE PAGAMENTO'),
      p('O pagamento será efetuado pelo COMPRADOR ao VENDEDOR no prazo combinado, mediante recebimento da mercadoria e apresentação da nota fiscal.'),
      p(),
      h(2, 'QUALIDADE E CLASSIFICAÇÃO'),
      p('A mercadoria deverá atender aos padrões mínimos de qualidade vigentes para a commodity, conforme normas do Ministério da Agricultura.'),
      p(),
      h(2, 'FORO'),
      p('Fica eleito o foro da comarca de {{empresa.cidade}}/{{empresa.uf}} para dirimir quaisquer questões oriundas deste contrato.'),
      p(),
      p('{{hoje.cidade}}, {{hoje.dataLonga}}.'),
      p(),
      p(),
      p('_____________________________________'),
      p(bold('{{empresa.razaoSocial}}')),
      p('(COMPRADOR)'),
      p(),
      p('_____________________________________'),
      p(bold('{{cliente.nome}}')),
      p('(VENDEDOR)'),
    ],
  }
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const data = schema.parse(body)

  const ws = await db.workspace.findUnique({
    where: { slug: data.workspaceSlug },
    select: { id: true },
  })
  if (!ws) {
    return NextResponse.json({ error: 'workspace_nao_encontrado' }, { status: 404 })
  }

  // Se já existe template default por tipo, não duplica
  const existentes = await db.contratoTemplate.findMany({
    where: { workspaceId: ws.id, isDefault: true },
    select: { id: true, tipo: true, nome: true },
  })

  const criados: string[] = []
  const pulados: string[] = []

  // Venda
  if (!existentes.some((t) => t.tipo === 'venda')) {
    const t = await db.contratoTemplate.create({
      data: {
        workspaceId: ws.id,
        nome: 'Padrão · Venda',
        tipo: 'venda',
        descricao: 'Modelo padrão de contrato de venda. Edite para refletir suas cláusulas comerciais reais.',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentJson: buildContentVenda() as any,
        ativo: true,
        isDefault: true,
        versao: 1,
      },
      select: { id: true, nome: true },
    })
    criados.push(`${t.nome} (${t.id})`)
  } else {
    pulados.push('venda já existe')
  }

  // Compra
  if (!existentes.some((t) => t.tipo === 'compra')) {
    const t = await db.contratoTemplate.create({
      data: {
        workspaceId: ws.id,
        nome: 'Padrão · Compra',
        tipo: 'compra',
        descricao: 'Modelo padrão de contrato de compra. Edite para refletir suas cláusulas comerciais reais.',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentJson: buildContentCompra() as any,
        ativo: true,
        isDefault: true,
        versao: 1,
      },
      select: { id: true, nome: true },
    })
    criados.push(`${t.nome} (${t.id})`)
  } else {
    pulados.push('compra já existe')
  }

  return NextResponse.json({ ok: true, workspaceId: ws.id, criados, pulados })
}
