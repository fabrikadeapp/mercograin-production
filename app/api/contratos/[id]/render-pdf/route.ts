import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { resolveContent, type RenderContext, type ProductInfo } from '@/lib/contratos/render-template'
import { renderTemplateToPdfBuffer } from '@/lib/contratos/pdf-renderer'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const templateIdInput: string | undefined = body?.templateId

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
        proposta: true,
      },
    })
    if (!contrato) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Resolve template
    let template = templateIdInput
      ? await db.contratoTemplate.findFirst({
          where: { id: templateIdInput, ...scope.whereOwn() },
        })
      : null

    if (!template) {
      // Default by tipo of proposta else any default
      const tipo = contrato.proposta?.tipo
      template = await db.contratoTemplate.findFirst({
        where: {
          ...scope.whereOwn(),
          ativo: true,
          isDefault: true,
          ...(tipo ? { tipo } : {}),
        },
      })
    }
    if (!template) {
      // Fallback: any active template
      template = await db.contratoTemplate.findFirst({
        where: { ...scope.whereOwn(), ativo: true },
        orderBy: { updatedAt: 'desc' },
      })
    }
    if (!template) {
      return NextResponse.json(
        { error: 'Nenhum template disponível. Crie um template em /contratos/templates.' },
        { status: 400 }
      )
    }

    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    })

    // Build product (first grão of proposta.graos)
    let produto: ProductInfo | undefined
    const graos = (contrato.proposta?.graos as any) ?? []
    if (Array.isArray(graos) && graos.length > 0) {
      const g = graos[0]
      produto = {
        grao: String(g.grao ?? ''),
        quantidade: Number(g.quantidade ?? 0),
        preco: Number(g.preco ?? 0),
        subtotal: Number(g.subtotal ?? Number(g.quantidade ?? 0) * Number(g.preco ?? 0)),
        unidade: String(g.unidade ?? 't'),
      }
    }

    const ctx: RenderContext = {
      empresa,
      cliente: contrato.cliente,
      contrato,
      produto,
    }

    const resolved = resolveContent(template.contentJson, ctx)

    // Tabela de grãos: convert proposta.graos to ItemGrao[] (quantidade em sacas)
    const itensGrao = Array.isArray(graos)
      ? graos
          .map((g: any) => {
            const unidade = String(g?.unidade ?? 't').toLowerCase()
            const qtdRaw = Number(g?.quantidade ?? 0)
            // Converter para sacas se em toneladas (1 t = 16.6667 sc de 60kg)
            const quantidadeSc = unidade === 't' ? qtdRaw * (1000 / 60) : qtdRaw
            return {
              grao: String(g?.grao ?? ''),
              quantidadeSc: Math.round(quantidadeSc),
              precoSc: Number(g?.preco ?? 0),
            }
          })
          .filter((it) => it.quantidadeSc > 0 || it.precoSc > 0)
      : []

    const buffer = await renderTemplateToPdfBuffer(resolved, {
      customLogoUrl: empresa?.logoUrl ?? null,
      itensGrao,
      documentTitle: `Contrato ${contrato.numero}`,
    })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato-${contrato.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('[contratos render-pdf]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
