import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import {
  renderToBuffer,
  renderToStream,
  Font,
} from '@react-pdf/renderer'
import { RelatorioUsdaDocument } from '@/lib/usda/relatorio-pdf'
import type { RelatorioUsda } from '@/lib/usda/relatorio'

// Mesmo workaround do pdf-service: força hyphenation no-op para evitar o bug
// "Cannot read properties of null (reading 'write')" no @react-pdf em Node 22.
Font.registerHyphenationCallback((word) => [word])

/**
 * Renderiza um documento React-PDF para Buffer com camadas de fallback,
 * espelhando a estratégia resiliente de lib/pdf-service.ts.
 */
async function renderPdfResiliente(
  buildElement: () => React.ReactElement,
): Promise<Buffer> {
  let lastErr: unknown = null

  // Camada A: renderToBuffer (mais rápido)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await renderToBuffer(buildElement())
    } catch (error) {
      lastErr = error
      console.warn(
        `[pdf] relatorio-usda renderToBuffer attempt ${attempt}/3 falhou:`,
        error instanceof Error ? error.message : error,
      )
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt - 1)))
    }
  }

  // Camada B: renderToStream (código path diferente, fallback final)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const stream = await renderToStream(buildElement())
      const chunks: Buffer[] = []
      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        })
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        )
      })
    } catch (error) {
      lastErr = error
      console.warn(
        `[pdf] relatorio-usda renderToStream attempt ${attempt}/2 falhou:`,
        error instanceof Error ? error.message : error,
      )
      await new Promise((r) => setTimeout(r, 200 * attempt))
    }
  }

  console.error('[pdf] relatorio-usda esgotou todas as tentativas:', lastErr)
  throw new Error('Falha ao gerar PDF do relatório USDA')
}

/**
 * GET /api/relatorios-usda/[id]/pdf
 * Gera e baixa o PDF de um relatório USDA persistido.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca o relatório dentro do escopo do workspace (multi-tenancy)
    const registro = await db.relatorioUsda.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { dados: true, titulo: true },
    })

    if (!registro) {
      return NextResponse.json(
        { error: 'Relatório não encontrado' },
        { status: 404 },
      )
    }

    // `dados` é o snapshot do RelatorioUsda montado (secoes/linhas)
    const relatorio = registro.dados as unknown as RelatorioUsda
    if (!relatorio || !Array.isArray(relatorio.secoes)) {
      return NextResponse.json(
        { error: 'Dados do relatório inválidos' },
        { status: 422 },
      )
    }

    // Branding da workspace (corretora) para o cabeçalho do PDF
    const empresa = await db.dadosEmpresa.findFirst({
      where: { workspaceId: scope.workspaceId },
      select: { logoUrl: true, razaoSocial: true, nomeFantasia: true },
    })
    const workspace = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true },
    })

    // Resolver logoUrl para URL absoluta acessível pelo @react-pdf
    let logoAbsoluta: string | undefined
    if (empresa?.logoUrl) {
      if (/^https?:\/\//.test(empresa.logoUrl)) {
        logoAbsoluta = empresa.logoUrl
      } else if (empresa.logoUrl.startsWith('/')) {
        const origin = request.headers.get('origin') ?? request.nextUrl.origin
        logoAbsoluta = `${origin}${empresa.logoUrl}`
      } else {
        logoAbsoluta = empresa.logoUrl
      }
    }

    const brandNome =
      empresa?.nomeFantasia ||
      empresa?.razaoSocial ||
      workspace?.name ||
      undefined

    const pdfBuffer = await renderPdfResiliente(() =>
      RelatorioUsdaDocument({
        relatorio,
        brandLogoUrl: logoAbsoluta,
        brandNome,
      }),
    )

    // Nome de arquivo seguro a partir do título
    const nomeArquivo =
      (registro.titulo || 'Relatorio-USDA')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'Relatorio-USDA'

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Generate relatorio USDA PDF error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF do relatório USDA' },
      { status: 500 },
    )
  }
}
