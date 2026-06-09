/**
 * GET /api/mesa/alertas-compliance — alertas de compliance/documentos (F1-01).
 *
 * Consolida: CAR de propriedade vencendo (renovação anual de referência),
 * KYC com pendências/reprovado, e cadastros de cliente em análise/rejeitado.
 * Read-only, reusa dados já existentes (sem novo storage).
 *
 * Retorno: { ok, alertas: [{ tipo, severidade, cliente, descricao, dias? }], total }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CAR_VALIDADE_DIAS = 365 // referência de renovação anual

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now = Date.now()
  const alertas: Array<{ tipo: string; severidade: string; cliente: string; descricao: string; dias?: number; href: string }> = []

  // 1. KYC com pendências/reprovado
  const kyc = await db.cliente.findMany({
    where: scope.whereOwn({ kycStatus: { in: ['pendencias', 'reprovado'] } }),
    select: { id: true, nome: true, kycStatus: true },
    take: 100,
  })
  for (const c of kyc) {
    alertas.push({
      tipo: 'kyc',
      severidade: c.kycStatus === 'reprovado' ? 'critico' : 'aviso',
      cliente: c.nome,
      descricao: c.kycStatus === 'reprovado' ? 'KYC reprovado — operar exige revisão' : 'KYC com pendências',
      href: `/clientes/${c.id}`,
    })
  }

  // 2. Cadastros em análise/rejeitado (excluindo leads rascunho, que são prospects)
  const cad = await db.cliente.findMany({
    where: scope.whereOwn({ statusCadastral: { in: ['analise', 'rejeitado'] } }),
    select: { id: true, nome: true, statusCadastral: true },
    take: 100,
  })
  for (const c of cad) {
    alertas.push({
      tipo: 'cadastro',
      severidade: c.statusCadastral === 'rejeitado' ? 'critico' : 'aviso',
      cliente: c.nome,
      descricao: c.statusCadastral === 'rejeitado' ? 'Cadastro rejeitado' : 'Cadastro em análise',
      href: `/clientes/${c.id}`,
    })
  }

  // 3. CAR vencendo (validado há > 11 meses) ou inválido
  const props = await db.propriedadeRural.findMany({
    where: scope.whereOwnVia('produtor', {
      OR: [
        { carValidadoEm: { lt: new Date(now - (CAR_VALIDADE_DIAS - 30) * 86_400_000) } },
        { carStatus: { in: ['invalido', 'cancelado'] } },
      ],
    }),
    select: { id: true, nome: true, carValidadoEm: true, carStatus: true, produtor: { select: { nome: true } } },
    take: 100,
  }).catch(() => [])

  for (const p of props as any[]) {
    let dias: number | undefined
    let sev = 'aviso'
    let desc = 'CAR a renovar'
    if (p.carStatus === 'invalido' || p.carStatus === 'cancelado') {
      sev = 'critico'
      desc = `CAR ${p.carStatus}`
    } else if (p.carValidadoEm) {
      const venceEm = new Date(p.carValidadoEm).getTime() + CAR_VALIDADE_DIAS * 86_400_000
      dias = Math.round((venceEm - now) / 86_400_000)
      sev = dias < 0 ? 'critico' : 'aviso'
      desc = dias < 0 ? `CAR vencido há ${Math.abs(dias)}d` : `CAR vence em ${dias}d`
    }
    alertas.push({
      tipo: 'documento',
      severidade: sev,
      cliente: `${p.produtor?.nome ?? ''} · ${p.nome}`,
      descricao: desc,
      dias,
      href: `/clientes`,
    })
  }

  const ordem: Record<string, number> = { critico: 2, aviso: 1 }
  alertas.sort((a, b) => (ordem[b.severidade] ?? 0) - (ordem[a.severidade] ?? 0))

  return NextResponse.json({ ok: true, alertas, total: alertas.length, criticos: alertas.filter((a) => a.severidade === 'critico').length })
}
