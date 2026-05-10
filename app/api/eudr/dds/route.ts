/**
 * S5 M9 — Endpoints DDS (lista + criação).
 *
 * GET  /api/eudr/dds          — lista DDS do workspace
 * POST /api/eudr/dds          — cria DDS a partir de contrato + cultura + qtd
 *
 * Ao criar, monta snapshots de propriedades/lotes via cadeia de custódia
 * (Contrato -> Lotes via Romaneios/Tickets -> TalhaoLote -> Talhao -> Propriedade)
 * e avalia risco.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { avaliarRisco, agregarRisco } from '@/lib/eudr/risco'
import { logAudit } from '@/lib/audit/log'

const createSchema = z.object({
  contratoId: z.string().optional(),
  operadorNome: z.string().min(2),
  operadorCnpj: z.string().min(11),
  operadorEndereco: z.string().min(2),
  cultura: z.string().min(2),
  ncm: z.string().min(4),
  qtdToneladas: z.number().positive(),
  observacoes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conclusao = searchParams.get('conclusao') || undefined
  const items = await db.dueDiligenceStatement.findMany({
    where: { ...scope.whereOwn(), ...(conclusao ? { conclusao } : {}) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      numero: true,
      contratoId: true,
      cultura: true,
      qtdToneladas: true,
      riscoNivel: true,
      conclusao: true,
      atestadoEm: true,
      pdfUrl: true,
      createdAt: true,
    },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', detail: parsed.error.format() }, { status: 400 })
  }
  const data = parsed.data

  // Snapshots: monta cadeia se contrato informado
  let propriedadesOrigem: any[] = []
  let lotesEnvolvidos: any[] = []

  if (data.contratoId) {
    const contrato = await db.contrato.findFirst({
      where: { id: data.contratoId, ...scope.whereOwn() },
      select: { id: true, numero: true },
    })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado no workspace' }, { status: 404 })
    }

    // Lotes ligados via TicketBalanca que tem Romaneio cujo contratosIds contém este contrato
    const tickets = await db.ticketBalanca.findMany({
      where: {
        ...scope.whereOwn(),
        romaneio: { contratosIds: { has: contrato.id } },
        loteId: { not: null },
      },
      select: { id: true, loteId: true },
    })
    const loteIds = Array.from(new Set(tickets.map((t) => t.loteId).filter(Boolean) as string[]))

    if (loteIds.length > 0) {
      const lotes = await db.loteEstoque.findMany({
        where: { id: { in: loteIds }, ...scope.whereOwn() },
        include: {
          talhaoLotes: {
            include: {
              talhao: { include: { propriedade: true } },
            },
          },
        },
      })

      const propMap = new Map<string, any>()
      for (const lote of lotes) {
        const talhoesOrigem: string[] = []
        for (const tl of lote.talhaoLotes) {
          talhoesOrigem.push(tl.talhao.nome)
          const p = tl.talhao.propriedade
          if (p && !propMap.has(p.id)) {
            propMap.set(p.id, {
              propriedadeId: p.id,
              nome: p.nome,
              car: p.car,
              carStatus: p.carStatus,
              areaHa: p.areaTotalHa,
              municipio: p.municipio,
              uf: p.uf,
              centroideLat: p.centroideLat,
              centroideLng: p.centroideLng,
              embargoIbama: p.embargoIbama,
              sobreposicaoTI: p.sobreposicaoTI,
              sobreposicaoUC: p.sobreposicaoUC,
              geoJson: p.geoJson,
              alertasMapBiomas: p.alertaDesmatamento,
            })
          }
        }
        lotesEnvolvidos.push({
          loteId: lote.id,
          numero: lote.numero,
          qtdSc: lote.qtdAtualSc,
          talhoesOrigem: Array.from(new Set(talhoesOrigem)),
        })
      }
      propriedadesOrigem = Array.from(propMap.values())
    }
  }

  // Avalia risco — pior propriedade domina
  const avaliacoes = propriedadesOrigem.map((p) =>
    avaliarRisco({
      propriedade: {
        car: p.car,
        carStatus: p.carStatus,
        embargoIbama: p.embargoIbama,
        sobreposicaoTI: p.sobreposicaoTI,
        sobreposicaoUC: p.sobreposicaoUC,
        geoJson: p.geoJson,
        alertaDesmatamento: Array.isArray(p.alertasMapBiomas?.alertas)
          ? p.alertasMapBiomas.alertas
          : null,
      },
    }),
  )
  const risco = agregarRisco(avaliacoes)

  // Gera próximo número DDS-YYYY-NNN
  const ano = new Date().getFullYear()
  const count = await db.dueDiligenceStatement.count({
    where: { workspaceId: scope.workspaceId, numero: { startsWith: `DDS-${ano}-` } },
  })
  const numero = `DDS-${ano}-${String(count + 1).padStart(4, '0')}`

  const created = await db.dueDiligenceStatement.create({
    data: {
      workspaceId: scope.workspaceId,
      numero,
      contratoId: data.contratoId || null,
      operadorNome: data.operadorNome,
      operadorCnpj: data.operadorCnpj.replace(/\D/g, ''),
      operadorEndereco: data.operadorEndereco,
      cultura: data.cultura,
      ncm: data.ncm,
      qtdToneladas: data.qtdToneladas,
      propriedadesOrigem: propriedadesOrigem as any,
      lotesEnvolvidos: lotesEnvolvidos as any,
      riscoNivel: risco.nivel,
      riscoFatores: risco.fatores as any,
      observacoes: data.observacoes || null,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'dds',
    entidadeId: created.id,
    mudancas: {
      numero,
      contratoId: data.contratoId,
      riscoNivel: risco.nivel,
      propriedades: propriedadesOrigem.length,
      lotes: lotesEnvolvidos.length,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
