/**
 * Negócios / deal flow (F1-04). Feature 'match'.
 *
 * GET  → lista negócios agrupáveis por estágio (funil) com contrapartes.
 * POST → cria negócio a partir de um match { ofertaVendaId, demandaCompraId }
 *        ou manual. Resolve contrapartes via Oferta.proprietario/cliente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function gerarNumero(): string {
  const d = new Date()
  return `NEG${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const negocios = await db.negocio.findMany({
    where: scope.whereOwn(),
    orderBy: { updatedAt: 'desc' },
    take: 300,
  })

  // Resolve nomes das contrapartes em lote.
  const clienteIds = Array.from(new Set(negocios.flatMap((n) => [n.vendedorClienteId, n.compradorClienteId]).filter(Boolean) as string[]))
  const clientes = clienteIds.length
    ? await db.cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nome: true } })
    : []
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]))

  const itens = negocios.map((n) => ({
    id: n.id, numero: n.numero, estagio: n.estagio, cultura: n.cultura,
    qtdSc: n.qtdSc != null ? Number(n.qtdSc) : null, precoSc: n.precoSc != null ? Number(n.precoSc) : null,
    vendedor: n.vendedorClienteId ? nomeCliente.get(n.vendedorClienteId) ?? null : null,
    comprador: n.compradorClienteId ? nomeCliente.get(n.compradorClienteId) ?? null : null,
    estagioMudadoEm: n.estagioMudadoEm.toISOString(),
  }))

  return NextResponse.json({ ok: true, itens })
}

const postSchema = z.object({
  ofertaVendaId: z.string().optional(),
  demandaCompraId: z.string().optional(),
  cultura: z.string().optional(),
  qtdSc: z.number().optional(),
  precoSc: z.number().optional(),
})

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const d = parsed.data

  // Carrega oferta/demanda para herdar termos e contrapartes.
  const [oferta, demanda] = await Promise.all([
    d.ofertaVendaId ? db.oferta.findFirst({ where: { id: d.ofertaVendaId, ...scope.whereOwn() }, include: { proposta: { select: { clienteId: true } } } }) : null,
    d.demandaCompraId ? db.oferta.findFirst({ where: { id: d.demandaCompraId, ...scope.whereOwn() }, include: { proposta: { select: { clienteId: true } } } }) : null,
  ])

  const cultura = d.cultura ?? oferta?.cultura ?? demanda?.cultura ?? null
  const qtdSc = d.qtdSc ?? (oferta ? Number(oferta.qtdSc) : demanda ? Number(demanda.qtdSc) : null)
  const precoSc = d.precoSc ?? (oferta ? Number(oferta.precoSc) : demanda ? Number(demanda.precoSc) : null)

  const negocio = await db.negocio.create({
    data: {
      workspaceId: scope.workspaceId,
      numero: gerarNumero(),
      ofertaVendaId: d.ofertaVendaId ?? null,
      demandaCompraId: d.demandaCompraId ?? null,
      vendedorClienteId: oferta?.proposta?.clienteId ?? null,
      compradorClienteId: demanda?.proposta?.clienteId ?? null,
      cultura,
      qtdSc: qtdSc ?? undefined,
      precoSc: precoSc ?? undefined,
      estagio: d.ofertaVendaId && d.demandaCompraId ? 'match' : 'captado',
      responsavelId: null,
      estagioMudadoEm: new Date(),
      historico: [{ estagio: 'match', em: new Date().toISOString(), por: scope.userId }],
    },
    select: { id: true, numero: true },
  })

  await logAudit({
    userId: scope.userId, workspaceId: scope.workspaceId, acao: 'negocio_criado',
    entidade: 'negocio', entidadeId: negocio.id,
    mudancas: { numero: negocio.numero, ofertaVendaId: d.ofertaVendaId, demandaCompraId: d.demandaCompraId },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, negocio })
}
