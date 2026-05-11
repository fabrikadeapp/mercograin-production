/**
 * GET /api/openapi.json — retorna spec OpenAPI 3.1 auto-gerada.
 *
 * Cacheada por 1h em produção (revalidate). ZERO custo de geração.
 */
import { NextResponse } from 'next/server'
import { gerarOpenAPISpec } from '@/lib/openapi/spec'

export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const spec = gerarOpenAPISpec(process.cwd())
  return NextResponse.json(spec, {
    headers: { 'cache-control': 'public, max-age=3600, s-maxage=3600' },
  })
}
