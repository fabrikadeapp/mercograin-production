/**
 * Dashboard de execução de contratos: contratado vs executado.
 *
 * Agrega:
 *  - Quantidade contratada por contrato → soma de Proposta.graos[].quantidadeSc
 *  - Quantidade executada → soma de TicketBalanca.pesoLiquidoKg (finalizado/classificado)
 *    de todos os romaneios que referenciam o contrato em `contratosIds`.
 *
 * Conversão para sacas usa 60 kg/sc (default agro Brasil).
 *
 * Retorna lista paginada/filtrada e cards de resumo.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

const KG_POR_SACA = 60

function somaSacasGraos(graos: unknown): number {
  if (!graos) return 0
  let arr: any[] = []
  if (Array.isArray(graos)) arr = graos
  else if (typeof graos === 'object') arr = Object.values(graos as object)
  let total = 0
  for (const g of arr) {
    const q = Number(g?.quantidadeSc ?? g?.qtdSc ?? g?.quantidade ?? 0)
    if (Number.isFinite(q)) total += q
  }
  return total
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const cultura = searchParams.get('cultura') || undefined
  const minPct = parseFloat(searchParams.get('minPct') || '0')
  const maxPct = parseFloat(searchParams.get('maxPct') || '999')

  const whereContrato: any = {
    ...scope.whereOwn(),
    // exclui contratos cancelados/expirados
    statusAssinatura: { in: ['pendente', 'assinado', 'aceito'] },
  }

  const contratos = await db.contrato.findMany({
    where: whereContrato,
    select: {
      id: true,
      numero: true,
      dataInicio: true,
      dataFim: true,
      statusAssinatura: true,
      modalidade: true,
      cliente: { select: { id: true, nome: true } },
      proposta: { select: { graos: true, tipo: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: 500,
  })

  // Romaneios + tickets agregados — pega tudo do workspace de uma vez
  const romaneios = await db.romaneio.findMany({
    where: {
      ...scope.whereOwn(),
      status: { in: ['em_transito', 'recebido'] },
    },
    select: {
      contratosIds: true,
      cultura: true,
      ticketsBalanca: {
        where: { status: { in: ['classificado', 'finalizado'] } },
        select: { pesoLiquidoKg: true, status: true },
      },
    },
  })

  // Index: contratoId → kg executado
  const execKgPorContrato = new Map<string, number>()
  for (const r of romaneios) {
    const kg = r.ticketsBalanca.reduce((s, t) => s + (t.pesoLiquidoKg || 0), 0)
    if (kg === 0) continue
    // Distribui igualmente entre os contratos do romaneio (caso multi-contrato)
    const ids = r.contratosIds || []
    if (ids.length === 0) continue
    const share = kg / ids.length
    for (const cid of ids) {
      execKgPorContrato.set(cid, (execKgPorContrato.get(cid) || 0) + share)
    }
  }

  const linhas = contratos
    .map((c) => {
      const graos: any = c.proposta?.graos
      const primeiraCultura = (() => {
        const arr = Array.isArray(graos) ? graos : graos ? Object.values(graos) : []
        const first: any = arr[0]
        return (first?.cultura || first?.grao || 'soja') as string
      })()
      const qtdContratoSc = somaSacasGraos(graos)
      const execKg = execKgPorContrato.get(c.id) || 0
      const qtdExecutadoSc = execKg / KG_POR_SACA
      const pctExecutado =
        qtdContratoSc > 0 ? (qtdExecutadoSc / qtdContratoSc) * 100 : 0
      const emAtraso =
        c.dataFim ? new Date() > c.dataFim && pctExecutado < 100 : false

      return {
        contratoId: c.id,
        numero: c.numero,
        cliente: c.cliente?.nome || '—',
        clienteId: c.cliente?.id,
        cultura: primeiraCultura,
        modalidade: c.modalidade,
        tipo: c.proposta?.tipo || 'venda',
        qtdContratoSc: Math.round(qtdContratoSc * 100) / 100,
        qtdExecutadoSc: Math.round(qtdExecutadoSc * 100) / 100,
        pctExecutado: Math.round(pctExecutado * 100) / 100,
        emAtraso,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim,
      }
    })
    .filter((l) => !cultura || l.cultura === cultura)
    .filter((l) => l.pctExecutado >= minPct && l.pctExecutado <= maxPct)
    .sort((a, b) => a.pctExecutado - b.pctExecutado)

  // Resumo agregado
  const totalContratoSc = linhas.reduce((s, l) => s + l.qtdContratoSc, 0)
  const totalExecutadoSc = linhas.reduce((s, l) => s + l.qtdExecutadoSc, 0)
  const pctGeral =
    totalContratoSc > 0 ? (totalExecutadoSc / totalContratoSc) * 100 : 0

  const resumo = {
    totalContratos: linhas.length,
    contratosEmAtraso: linhas.filter((l) => l.emAtraso).length,
    contratosConcluidos: linhas.filter((l) => l.pctExecutado >= 100).length,
    totalContratoSc: Math.round(totalContratoSc * 100) / 100,
    totalExecutadoSc: Math.round(totalExecutadoSc * 100) / 100,
    pctGeral: Math.round(pctGeral * 100) / 100,
  }

  return NextResponse.json({ resumo, linhas })
}
