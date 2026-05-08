import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// GET - exporta CSV de fornecedores do workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tipo = searchParams.get('tipo') || ''
    const ativoParam = searchParams.get('ativo')

    const filters: Record<string, any> = {}
    if (tipo) filters.tipo = tipo
    if (ativoParam !== null && ativoParam !== '') {
      filters.ativo = ativoParam === 'true'
    }

    const rows = await db.fornecedor.findMany({
      where: scope.whereOwn(filters),
      orderBy: { razaoSocial: 'asc' },
    })

    const header = [
      'razaoSocial',
      'nomeFantasia',
      'cnpj',
      'tipo',
      'contato',
      'telefone',
      'email',
      'cidade',
      'uf',
      'ativo',
    ]

    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.razaoSocial,
          r.nomeFantasia,
          r.cnpj,
          r.tipo,
          r.contato,
          r.telefone,
          r.email,
          r.cidade,
          r.uf,
          r.ativo ? 'sim' : 'não',
        ]
          .map(csvEscape)
          .join(',')
      )
    }

    const csv = lines.join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fornecedores-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export fornecedores error:', error)
    return NextResponse.json(
      { error: 'Erro ao exportar fornecedores' },
      { status: 500 }
    )
  }
}
