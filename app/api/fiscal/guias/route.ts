/**
 * CRUD Guias fiscais (DARF/GNRE/GARE).
 *
 * GET  ?tipo=darf|gnre|gare & status=aberto|pago|cancelado  → lista
 * POST { tipo, codigoReceita, contribuinteDoc, contribuinteNome, periodoApuracao,
 *        valorPrincipal, multa?, juros?, vencimento, uf? }
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { gerarDARF } from '@/lib/fiscal/guias/darf'
import { gerarGNRE } from '@/lib/fiscal/guias/gnre'
import { gerarGARE } from '@/lib/fiscal/guias/gare'
import { z } from 'zod'

const createSchema = z.object({
  tipo: z.enum(['darf', 'gnre', 'gare']),
  codigoReceita: z.string().min(1),
  contribuinteDoc: z.string().min(1),
  contribuinteNome: z.string().min(1),
  periodoApuracao: z.string().min(1),
  valorPrincipal: z.number().positive(),
  multa: z.number().nonnegative().optional(),
  juros: z.number().nonnegative().optional(),
  vencimento: z.string().datetime().or(z.string()),
  uf: z.string().length(2).optional(),
  ie: z.string().optional(), // GARE
  referenciaContratoId: z.string().optional(),
  observacoes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipo = searchParams.get('tipo') || undefined
  const status = searchParams.get('status') || undefined
  const where: any = scope.whereOwn()
  if (tipo) where.tipo = tipo
  if (status) where.status = status

  const data = await db.guia.findMany({
    where,
    orderBy: [{ vencimento: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data
  const vencimento = new Date(d.vencimento)
  if (isNaN(vencimento.getTime())) {
    return NextResponse.json({ error: 'Data vencimento inválida' }, { status: 400 })
  }

  // Sequencial por workspace
  const count = await db.guia.count({ where: scope.whereOwn() })
  const numero = `${d.tipo.toUpperCase()}-${String(count + 1).padStart(6, '0')}`

  let codigoBarras: string | null = null
  let linhaDigitavel: string | null = null
  let multa = d.multa ?? 0
  let juros = d.juros ?? 0
  let valorTotal = Number((d.valorPrincipal + multa + juros).toFixed(2))

  try {
    const contribuinte = { doc: d.contribuinteDoc, nome: d.contribuinteNome }
    const baseGen = {
      codigo: d.codigoReceita,
      contribuinte,
      periodo: d.periodoApuracao,
      valor: d.valorPrincipal,
      multa,
      juros,
      vencimento,
    }
    if (d.tipo === 'darf') {
      const r = gerarDARF(baseGen)
      codigoBarras = r.codigoBarras
      linhaDigitavel = r.linhaDigitavel
    } else if (d.tipo === 'gnre') {
      if (!d.uf) return NextResponse.json({ error: 'GNRE requer uf' }, { status: 400 })
      const r = gerarGNRE({ ...baseGen, uf: d.uf })
      codigoBarras = r.codigoBarras
      linhaDigitavel = r.linhaDigitavel
    } else {
      const r = gerarGARE({ ...baseGen, contribuinte: { ...contribuinte, ie: d.ie } })
      codigoBarras = r.codigoBarras
      linhaDigitavel = r.linhaDigitavel
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Falha gerar guia', detalhe: err?.message }, { status: 422 })
  }

  const guia = await db.guia.create({
    data: {
      workspaceId: scope.workspaceId,
      numero,
      tipo: d.tipo,
      codigoReceita: d.codigoReceita,
      contribuinteDoc: d.contribuinteDoc,
      contribuinteNome: d.contribuinteNome,
      periodoApuracao: d.periodoApuracao,
      valorPrincipal: d.valorPrincipal,
      multa,
      juros,
      valorTotal,
      vencimento,
      codigoBarras,
      linhaDigitavel,
      status: 'aberto',
      uf: d.uf ?? (d.tipo === 'gare' ? 'SP' : null),
      referenciaContratoId: d.referenciaContratoId,
      observacoes: d.observacoes,
    },
  })

  // Audit log
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'guia.create',
      entidade: 'Guia',
      entidadeId: guia.id,
      workspaceId: scope.workspaceId,
      mudancas: { tipo: d.tipo, numero, valorTotal },
    },
  }).catch(() => {})

  return NextResponse.json({ data: guia }, { status: 201 })
}
