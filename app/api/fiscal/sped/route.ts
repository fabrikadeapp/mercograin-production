/**
 * SPED Fiscal / Contribuições — listar e gerar.
 *
 * GET ?tipo=fiscal|contribuicoes  → lista exports do workspace
 * POST { tipo, competencia }       → gera novo SPED do mês
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { gerarSpedFiscal } from '@/lib/fiscal/sped/fiscal'
import { gerarSpedContribuicoes } from '@/lib/fiscal/sped/contribuicoes'
import { periodoMes } from '@/lib/fiscal/sped/util'
import { z } from 'zod'

const genSchema = z.object({
  tipo: z.enum(['fiscal', 'contribuicoes']),
  competencia: z.string().regex(/^\d{6}$/, 'Competência YYYYMM'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipo = searchParams.get('tipo') || undefined
  const where: any = scope.whereOwn()
  if (tipo) where.tipo = tipo

  const data = await db.spedExport.findMany({
    where,
    orderBy: [{ competencia: 'desc' }, { tipo: 'asc' }],
    take: 50,
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = genSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const { tipo, competencia } = parsed.data

  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })
  const empresaDB = await db.dadosEmpresa.findUnique({ where: { workspaceId: scope.workspaceId } })
  if (!cfg || !empresaDB) {
    return NextResponse.json({ error: 'Configuração fiscal ou dados da empresa incompletos' }, { status: 412 })
  }

  // Buscar notas do período (status autorizadas/canceladas — SPED inclui canceladas com flag)
  const { ini, fim } = periodoMes(competencia)
  const notas = await db.notaFiscal.findMany({
    where: {
      ...scope.whereOwn(),
      dataEmissao: { gte: ini, lte: fim },
      status: { in: ['autorizada', 'cancelada'] },
    },
    orderBy: { dataEmissao: 'asc' },
  })

  // Upsert export entry
  const exportEntry = await db.spedExport.upsert({
    where: { workspaceId_tipo_competencia: { workspaceId: scope.workspaceId, tipo, competencia } },
    create: {
      workspaceId: scope.workspaceId,
      tipo,
      competencia,
      status: 'processando',
    },
    update: { status: 'processando', erroMsg: null },
  })

  try {
    const empresa = {
      razaoSocial: empresaDB.razaoSocial,
      cnpj: (empresaDB.cnpj ?? cfg.cnpjEmissor).replace(/\D/g, ''),
      uf: empresaDB.uf ?? 'RS',
      inscricaoEstadual: empresaDB.inscricaoEstadual ?? cfg.inscricaoEstadual,
      codigoMunicipioIBGE: null,
    }

    const out = tipo === 'fiscal'
      ? await gerarSpedFiscal({ config: cfg, competencia, empresa, notas: notas as any })
      : await gerarSpedContribuicoes({ config: cfg, competencia, empresa, notas: notas as any })

    // TODO produção: subir conteúdo pro Supabase Storage e salvar URL.
    // Aqui guardamos o arquivo num campo dataURL inline (apenas pra MVP, evita storage extra).
    const arquivoUrl = `data:text/plain;base64,${Buffer.from(out.conteudo, 'utf-8').toString('base64')}`

    const updated = await db.spedExport.update({
      where: { id: exportEntry.id },
      data: {
        status: 'pronto',
        totalRegistros: out.totalRegistros,
        hashArquivo: out.hash,
        arquivoUrl,
        geradoEm: new Date(),
      },
    })
    return NextResponse.json({ data: updated, totalRegistros: out.totalRegistros, notas: notas.length })
  } catch (err: any) {
    await db.spedExport.update({
      where: { id: exportEntry.id },
      data: { status: 'erro', erroMsg: err?.message ?? 'Falha na geração' },
    })
    return NextResponse.json({ error: 'Falha ao gerar SPED', detalhe: err?.message }, { status: 500 })
  }
}
