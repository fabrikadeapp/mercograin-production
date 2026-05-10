/**
 * SPED ECD — Escrituração Contábil Digital anual.
 *
 * POST { anoFiscal, planoContas?, lancamentos?, saldosPeriodicos?, balancete?, dre? }
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { gerarECD } from '@/lib/fiscal/sped/ecd'
import { z } from 'zod'

const schema = z.object({
  anoFiscal: z.number().int().min(2000).max(2100),
  planoContas: z.array(z.any()).optional(),
  saldosPeriodicos: z.array(z.any()).optional(),
  lancamentos: z.array(z.any()).optional(),
  balancete: z.array(z.any()).optional(),
  dre: z.array(z.any()).optional(),
})

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const { anoFiscal, planoContas = [], saldosPeriodicos = [], lancamentos = [], balancete = [], dre = [] } = parsed.data

  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })
  const empresaDB = await db.dadosEmpresa.findUnique({ where: { workspaceId: scope.workspaceId } })
  if (!cfg || !empresaDB) {
    return NextResponse.json({ error: 'Configuração fiscal ou dados da empresa incompletos' }, { status: 412 })
  }

  const competencia = `${anoFiscal}` // ECD é anual; usamos ano no campo competencia
  const exportEntry = await db.spedExport.upsert({
    where: { workspaceId_tipo_competencia: { workspaceId: scope.workspaceId, tipo: 'ecd', competencia } },
    create: { workspaceId: scope.workspaceId, tipo: 'ecd', competencia, status: 'processando' },
    update: { status: 'processando', erroMsg: null },
  })

  try {
    const out = await gerarECD({
      workspaceId: scope.workspaceId,
      anoFiscal,
      empresa: {
        razaoSocial: empresaDB.razaoSocial,
        cnpj: (empresaDB.cnpj ?? cfg.cnpjEmissor).replace(/\D/g, ''),
        uf: empresaDB.uf ?? 'RS',
        inscricaoEstadual: empresaDB.inscricaoEstadual ?? cfg.inscricaoEstadual,
        codigoMunicipioIBGE: null,
      },
      planoContas,
      saldosPeriodicos,
      lancamentos,
      balancete,
      dre,
    })

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
    return NextResponse.json({ data: updated, totalRegistros: out.totalRegistros, hash: out.hash })
  } catch (err: any) {
    await db.spedExport.update({
      where: { id: exportEntry.id },
      data: { status: 'erro', erroMsg: err?.message ?? 'Falha na geração' },
    })
    return NextResponse.json({ error: 'Falha ao gerar ECD', detalhe: err?.message }, { status: 500 })
  }
}
