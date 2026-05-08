/**
 * GET /api/cotacoes/historia?grao=soja&dias=240
 * Retorna histórico (label, value) de Cotacao agrupado por mês.
 * Fallback: array vazio quando banco vazio (frontend mostra empty state).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const grao = (searchParams.get('grao') || 'soja').toLowerCase()
    const dias = Math.min(720, parseInt(searchParams.get('dias') || '240'))

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    const rows = await db.cotacao.findMany({
      where: { grao, data: { gte: desde } },
      select: { data: true, preco: true },
      orderBy: { data: 'asc' },
    })

    if (rows.length === 0) {
      return NextResponse.json({ data: [], empty: true })
    }

    // agrega por mês (média)
    const buckets: Record<string, { sum: number; n: number; ts: number }> = {}
    for (const r of rows) {
      const d = new Date(r.data)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!buckets[key]) buckets[key] = { sum: 0, n: 0, ts: d.getTime() }
      buckets[key].sum += Number(r.preco)
      buckets[key].n += 1
    }
    const data = Object.entries(buckets)
      .sort((a, b) => a[1].ts - b[1].ts)
      .map(([key, b]) => {
        const [, monthStr] = key.split('-')
        return {
          label: MESES_PT[parseInt(monthStr)],
          value: Math.round((b.sum / b.n) * 100) / 100,
        }
      })

    return NextResponse.json({ data, empty: false })
  } catch (e: any) {
    console.error('GET /cotacoes/historia error:', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
