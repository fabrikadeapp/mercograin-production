/**
 * S5 M9 — Cron: sincronização de áreas protegidas (TI/UC/embargos).
 *
 * Trigger: Railway cron / GitHub Actions (mensal, dia 1 às 02:00 UTC).
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Fontes públicas:
 *  - FUNAI: shapefile Terras Indígenas
 *      https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas
 *  - ICMBio: GeoJSON Unidades de Conservação
 *      https://www.gov.br/icmbio/pt-br/servicos/geoprocessamento
 *  - IBAMA: áreas embargadas
 *      https://servicos.ibama.gov.br/ctf/publico/areasembargadas/...
 *
 * Para MVP, este endpoint é um stub: estrutura pronta, fetch real será
 * adicionado quando justificar (parsing shapefile/HTML não-trivial).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularBbox } from '@/lib/compliance/geo-bbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

interface AreaInput {
  tipo: 'terra_indigena' | 'unidade_conservacao' | 'embargo_ibama'
  nome: string
  uf?: string
  geoJson: any
  fonte: 'funai' | 'icmbio' | 'ibama'
  fonteUrl?: string
}

async function fetchFunai(): Promise<AreaInput[]> {
  // TODO: parsear shapefile FUNAI quando justificar
  return []
}
async function fetchIcmbio(): Promise<AreaInput[]> {
  // TODO: fetch GeoJSON ICMBio
  return []
}
async function fetchIbama(): Promise<AreaInput[]> {
  // TODO: scraping IBAMA + geocoding
  return []
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todas: AreaInput[] = [
    ...(await fetchFunai().catch(() => [])),
    ...(await fetchIcmbio().catch(() => [])),
    ...(await fetchIbama().catch(() => [])),
  ]

  let inserted = 0
  for (const a of todas) {
    const bbox = calcularBbox(a.geoJson)
    try {
      await db.areaProtegida.create({
        data: {
          tipo: a.tipo,
          nome: a.nome,
          uf: a.uf || null,
          geoJson: a.geoJson,
          bboxJson: (bbox as any) || undefined,
          fonte: a.fonte,
          fonteUrl: a.fonteUrl || null,
        },
      })
      inserted++
    } catch (err) {
      console.warn('[sync-areas] insert falhou:', (err as Error).message)
    }
  }

  return NextResponse.json({
    ok: true,
    fontes: ['funai', 'icmbio', 'ibama'],
    total: todas.length,
    inseridos: inserted,
    nota: 'Cron stub — fontes reais a implementar (shapefile parsing).',
  })
}
