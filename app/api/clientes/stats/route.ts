/**
 * POST /api/clientes/stats
 *
 * Recebe { ids: string[] } e retorna metadata pra enriquecer a lista:
 *   {
 *     [clienteId]: {
 *       temPortal: boolean,
 *       portalAtivo: boolean,
 *       ultimoLoginPortal: ISO | null,
 *       ultimaPropostaEm: ISO | null,
 *       ultimaPropostaNumero: string | null,
 *       receitaYTD: number,
 *       propostasYTD: number,
 *     }
 *   }
 *
 * 3 queries paralelas — não bloqueia a tabela.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const schema = z.object({
  ids: z.array(z.string()).min(1).max(100),
})

const STATUS_SUCESSO = ['aceita', 'aprovada', 'fechado', 'sucesso', 'concluido', 'faturado']

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const inicioAno = new Date(new Date().getFullYear(), 0, 1)

    const [acessos, ultimas, fechadasYTD] = await Promise.all([
      db.produtorAccess.findMany({
        where: { workspaceId: scope.workspaceId, clienteId: { in: data.ids } },
        select: { clienteId: true, ativo: true, ultimoLogin: true },
      }),
      // última proposta de cada cliente
      db.proposta.findMany({
        where: {
          workspaceId: scope.workspaceId,
          clienteId: { in: data.ids },
        },
        select: { clienteId: true, numero: true, criadaEm: true },
        orderBy: { criadaEm: 'desc' },
        take: data.ids.length * 5, // margem; deduplicamos abaixo
      }),
      // propostas fechadas no ano corrente
      db.proposta.findMany({
        where: {
          workspaceId: scope.workspaceId,
          clienteId: { in: data.ids },
          status: { in: STATUS_SUCESSO },
          atualizadaEm: { gte: inicioAno },
        },
        select: { clienteId: true, valorTotal: true },
      }),
    ])

    const out: Record<
      string,
      {
        temPortal: boolean
        portalAtivo: boolean
        ultimoLoginPortal: string | null
        ultimaPropostaEm: string | null
        ultimaPropostaNumero: string | null
        receitaYTD: number
        propostasYTD: number
      }
    > = {}

    for (const id of data.ids) {
      out[id] = {
        temPortal: false,
        portalAtivo: false,
        ultimoLoginPortal: null,
        ultimaPropostaEm: null,
        ultimaPropostaNumero: null,
        receitaYTD: 0,
        propostasYTD: 0,
      }
    }

    for (const a of acessos) {
      const slot = out[a.clienteId]
      if (!slot) continue
      slot.temPortal = true
      slot.portalAtivo = a.ativo
      slot.ultimoLoginPortal = a.ultimoLogin?.toISOString() ?? null
    }

    // Pega só a primeira (mais recente) por cliente
    const vistos = new Set<string>()
    for (const p of ultimas) {
      if (vistos.has(p.clienteId)) continue
      vistos.add(p.clienteId)
      const slot = out[p.clienteId]
      if (!slot) continue
      slot.ultimaPropostaEm = p.criadaEm.toISOString()
      slot.ultimaPropostaNumero = p.numero
    }

    for (const p of fechadasYTD) {
      const slot = out[p.clienteId]
      if (!slot) continue
      slot.receitaYTD += Number(p.valorTotal)
      slot.propostasYTD++
    }

    return NextResponse.json(out)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Clientes stats error:', error)
    return NextResponse.json({ error: 'Erro ao carregar estatísticas' }, { status: 500 })
  }
}
