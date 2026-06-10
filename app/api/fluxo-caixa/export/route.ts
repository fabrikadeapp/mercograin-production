/**
 * GET /api/fluxo-caixa/export
 * Exporta o fluxo de caixa em CSV (a receber + a pagar próximos vencimentos),
 * reusando as mesmas fontes do /resumo (Boleto + MovimentoFinanceiro). Sem mock.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  // Escapa aspas/; e quebra de linha conforme RFC 4180
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereOwn: any = scope.whereOwn()
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 86400000)

    const [aReceber, aPagar] = await Promise.all([
      db.boleto.findMany({
        where: { ...whereOwn, status: { in: ['aberto', 'vencido'] }, vencimento: { lte: in30 } },
        select: {
          valor: true,
          vencimento: true,
          status: true,
          contrato: { select: { numero: true } },
          cliente: { select: { nome: true } },
        },
        orderBy: { vencimento: 'asc' },
      }),
      db.movimentoFinanceiro.findMany({
        where: { ...whereOwn, tipo: 'despesa', conciliado: false, data: { lte: in30 } },
        select: { descricao: true, natureza: true, valor: true, data: true },
        orderBy: { data: 'asc' },
      }),
    ])

    const linhas: string[] = []
    linhas.push(['Tipo', 'Descrição', 'Referência', 'Vencimento', 'Valor', 'Situação'].map(csvCell).join(';'))

    for (const b of aReceber) {
      linhas.push([
        'A receber',
        b.cliente?.nome ?? '—',
        b.contrato?.numero ?? '—',
        b.vencimento ? new Date(b.vencimento).toLocaleDateString('pt-BR') : '—',
        brl(Number(b.valor)),
        b.status,
      ].map(csvCell).join(';'))
    }
    for (const d of aPagar) {
      linhas.push([
        'A pagar',
        d.descricao ?? '—',
        d.natureza ?? '—',
        d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—',
        brl(Number(d.valor)),
        d.data && new Date(d.data) < now ? 'vencido' : 'agendado',
      ].map(csvCell).join(';'))
    }

    // BOM para Excel reconhecer UTF-8 (acentos)
    const csv = '﻿' + linhas.join('\r\n')
    const hoje = now.toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fluxo-de-caixa-${hoje}.csv"`,
      },
    })
  } catch (e: unknown) {
    console.error('GET /fluxo-caixa/export error:', e)
    return NextResponse.json({ error: 'Erro ao exportar' }, { status: 500 })
  }
}
