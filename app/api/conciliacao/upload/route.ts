import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { parseOFX } from '@/lib/compliance/conciliacao-ofx'

/**
 * Upload de arquivo OFX. Multipart com campo "file".
 * Faz match heurístico com MovimentoFinanceiro existentes (mesma data±2d, mesmo valor).
 * Retorna preview — caller decide quais persistir.
 */
export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof (file as any).text !== 'function') {
      return NextResponse.json(
        { error: 'Arquivo OFX ausente' },
        { status: 400 }
      )
    }
    const persistir = form.get('persistir') === 'true'

    const conteudo = await (file as Blob).text()
    const transacoes = parseOFX(conteudo)

    const resultados: any[] = []
    for (const t of transacoes) {
      // 1) Já existe via hash?
      const existente = await db.movimentoFinanceiro.findUnique({
        where: { ofxLineHash: t.hash },
      })
      if (existente) {
        resultados.push({
          ofx: t,
          status: 'duplicado',
          movimentoId: existente.id,
        })
        continue
      }

      // 2) Tenta match com movimento existente sem hash (mesmo valor absoluto, ±2 dias)
      const dois = 2 * 24 * 60 * 60 * 1000
      const candidatos = await db.movimentoFinanceiro.findMany({
        where: {
          workspaceId: scope.workspaceId,
          ofxLineHash: null,
          conciliado: false,
          data: {
            gte: new Date(t.data.getTime() - dois),
            lte: new Date(t.data.getTime() + dois),
          },
          valor: Math.abs(t.valor),
        },
        take: 3,
      })

      if (candidatos.length === 1 && persistir) {
        await db.movimentoFinanceiro.update({
          where: { id: candidatos[0].id },
          data: {
            conciliado: true,
            conciliadoEm: new Date(),
            ofxLineHash: t.hash,
          },
        })
        resultados.push({
          ofx: t,
          status: 'conciliado',
          movimentoId: candidatos[0].id,
        })
      } else if (candidatos.length === 0 && persistir) {
        // Cria novo movimento já conciliado
        const novo = await db.movimentoFinanceiro.create({
          data: {
            workspaceId: scope.workspaceId,
            data: t.data,
            tipo: t.tipo === 'CREDIT' ? 'receita' : 'despesa',
            natureza: 'outros',
            valor: Math.abs(t.valor),
            descricao: t.descricao || `OFX ${t.identificadorBanco}`,
            conciliado: true,
            conciliadoEm: new Date(),
            ofxLineHash: t.hash,
          },
        })
        resultados.push({
          ofx: t,
          status: 'criado',
          movimentoId: novo.id,
        })
      } else {
        resultados.push({
          ofx: t,
          status: candidatos.length > 1 ? 'multiplos_matches' : 'sem_match',
          candidatos: candidatos.map((c) => ({ id: c.id, descricao: c.descricao })),
        })
      }
    }

    return NextResponse.json({
      total: transacoes.length,
      resultados,
      persistido: persistir,
    })
  } catch (e: any) {
    console.error('Upload OFX error:', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao processar OFX' },
      { status: 500 }
    )
  }
}
