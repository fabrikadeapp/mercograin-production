/**
 * GET /api/mesa/assinaturas
 *
 * Contratos aguardando assinatura digital (fila lateral da Mesa).
 * Junta Contrato (statusAssinatura='pendente') + AssinaturaDigital (signatários,
 * prazo de expiração). Ordena por prazo mais apertado primeiro.
 *
 * Retorno: { ok, items: [{ id, numero, cliente, resumo, status, assinaram,
 *            totalSignatarios, prazo, prazoHoras, href }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function commodityFromGraos(graos: unknown): string {
  if (Array.isArray(graos) && graos[0] && typeof graos[0] === 'object') {
    const g = graos[0] as Record<string, unknown>
    const nome = String(g.grao ?? '')
    const qtd = Number(g.quantidade ?? 0)
    if (nome) return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}${qtd ? ` · ${qtd.toLocaleString('pt-BR')} t` : ''}`
  }
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const contratos = await db.contrato.findMany({
    where: scope.whereOwn({ statusAssinatura: 'pendente' }),
    orderBy: { criadoEm: 'asc' },
    take: 25,
    include: {
      cliente: { select: { nome: true } },
      proposta: { select: { graos: true } },
      assinaturaDigital: {
        select: { status: true, signatarios: true, expiraEm: true, enviadoEm: true },
      },
    },
  })

  const items = contratos.map((c) => {
    const sig = Array.isArray(c.assinaturaDigital?.signatarios)
      ? (c.assinaturaDigital!.signatarios as Array<Record<string, unknown>>)
      : []
    const assinaram = sig.filter((s) => s.signedAt).length
    const expiraEm = c.assinaturaDigital?.expiraEm ?? c.dataFim ?? null
    const prazoHoras = expiraEm
      ? Math.round((new Date(expiraEm).getTime() - Date.now()) / 3_600_000)
      : null
    let prazo = 'sem prazo'
    if (prazoHoras != null) {
      if (prazoHoras < 0) prazo = 'vencido'
      else if (prazoHoras <= 24) prazo = 'vence hoje'
      else if (prazoHoras <= 48) prazo = 'vence amanhã'
      else prazo = `${Math.ceil(prazoHoras / 24)} dias`
    }
    return {
      id: c.id,
      numero: c.numero,
      cliente: c.cliente?.nome ?? 'Cliente',
      resumo: commodityFromGraos(c.proposta?.graos),
      status: c.assinaturaDigital?.status ?? 'pendente',
      assinaram,
      totalSignatarios: sig.length,
      prazo,
      prazoHoras,
      href: `/contratos/${c.id}`,
    }
  })

  // Mais apertado primeiro (prazoHoras crescente; null por último).
  items.sort((a, b) => {
    if (a.prazoHoras == null) return 1
    if (b.prazoHoras == null) return -1
    return a.prazoHoras - b.prazoHoras
  })

  return NextResponse.json({ ok: true, items })
}
