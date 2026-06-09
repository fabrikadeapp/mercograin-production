/**
 * GET /api/propostas/funil — cards de etapa do pipeline de propostas
 * (mesmo formato de /api/contratos/funil, usado nos PipelineStageCard).
 *
 * Conta só propostas que AINDA NÃO viraram contrato. Etapas:
 *   Rascunho · Enviada · Em negociação · Aceita · Recusada/Perdida
 *
 * Retorno: { items: [{ stage, color, count, percent, total }], totalCount }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1000) return `R$ ${Math.round(n / 1000)}k`
  return `R$ ${Math.round(n)}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const propostas = await db.proposta.findMany({
    where: scope.whereOwn({ contratos: { none: {} } }),
    select: { status: true, valorTotal: true },
  })

  const stages = {
    rascunho: { count: 0, total: 0 },
    enviada: { count: 0, total: 0 },
    negociacao: { count: 0, total: 0 },
    aceita: { count: 0, total: 0 },
    recusada: { count: 0, total: 0 },
  }
  for (const p of propostas) {
    const v = Number(p.valorTotal) || 0
    const s = (p.status || '').toLowerCase()
    if (/rascunho|pendente|pronta|aguardando/.test(s)) { stages.rascunho.count++; stages.rascunho.total += v }
    else if (s === 'enviada') { stages.enviada.count++; stages.enviada.total += v }
    else if (/negocia/.test(s)) { stages.negociacao.count++; stages.negociacao.total += v }
    else if (/aceita|aprovada|sucesso/.test(s)) { stages.aceita.count++; stages.aceita.total += v }
    else if (/recusada|rejeitada|expirada|cancelad|perdida/.test(s)) { stages.recusada.count++; stages.recusada.total += v }
  }

  const totalCount = Object.values(stages).reduce((s, x) => s + x.count, 0) || 1
  const pct = (n: number) => Math.round((n / totalCount) * 100)

  const items = [
    { stage: 'RASCUNHO', color: 'var(--info)', count: stages.rascunho.count, percent: pct(stages.rascunho.count), total: fmtBRL(stages.rascunho.total) },
    { stage: 'ENVIADA', color: 'color-mix(in srgb, var(--info) 60%, var(--bg-3))', count: stages.enviada.count, percent: pct(stages.enviada.count), total: fmtBRL(stages.enviada.total) },
    { stage: 'EM NEGOCIAÇÃO', color: 'var(--warn)', count: stages.negociacao.count, percent: pct(stages.negociacao.count), total: fmtBRL(stages.negociacao.total) },
    { stage: 'ACEITA', color: 'var(--accent)', count: stages.aceita.count, percent: pct(stages.aceita.count), total: fmtBRL(stages.aceita.total) },
    { stage: 'RECUSADA', color: 'var(--danger)', count: stages.recusada.count, percent: pct(stages.recusada.count), total: fmtBRL(stages.recusada.total) },
  ]

  return NextResponse.json({ items, totalCount: Object.values(stages).reduce((s, x) => s + x.count, 0) })
}
