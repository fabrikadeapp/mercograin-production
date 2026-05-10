/**
 * SPED ECF — Escrituração Contábil Fiscal anual.
 *
 * POST { anoFiscal, formaTributacao?, dadosDRE, apuracoesTrimestrais?, atividadesIncentivadas? }
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { gerarECF } from '@/lib/fiscal/sped/ecf'
import { z } from 'zod'

const dreSchema = z.object({
  receitaBruta: z.number(),
  deducoes: z.number(),
  receitaLiquida: z.number(),
  custos: z.number(),
  lucroBruto: z.number(),
  despesasOperacionais: z.number(),
  resultadoOperacional: z.number(),
  outrasReceitas: z.number(),
  outrasDespesas: z.number(),
  lucroAntesIR: z.number(),
  irpj: z.number(),
  csll: z.number(),
  lucroLiquido: z.number(),
})

const schema = z.object({
  anoFiscal: z.number().int().min(2000).max(2100),
  formaTributacao: z.enum(['1', '2', '3', '4', '5']).optional(),
  dadosDRE: dreSchema,
  apuracoesTrimestrais: z.array(z.any()).optional(),
  atividadesIncentivadas: z.array(z.any()).optional(),
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
  const { anoFiscal, formaTributacao, dadosDRE, apuracoesTrimestrais = [], atividadesIncentivadas = [] } = parsed.data

  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })
  const empresaDB = await db.dadosEmpresa.findUnique({ where: { workspaceId: scope.workspaceId } })
  if (!cfg || !empresaDB) {
    return NextResponse.json({ error: 'Configuração fiscal ou dados da empresa incompletos' }, { status: 412 })
  }

  // Derivar formaTributacao do regime se não veio explícito
  let forma: '1' | '2' | '3' | '4' | '5' = formaTributacao ?? '1'
  if (!formaTributacao) {
    if (cfg.regimeTributario === 'lucro_real') forma = '1'
    else if (cfg.regimeTributario === 'lucro_presumido') forma = '3'
    else if (cfg.regimeTributario === 'simples_nacional') forma = '5'
  }

  const competencia = `${anoFiscal}`
  const exportEntry = await db.spedExport.upsert({
    where: { workspaceId_tipo_competencia: { workspaceId: scope.workspaceId, tipo: 'ecf', competencia } },
    create: { workspaceId: scope.workspaceId, tipo: 'ecf', competencia, status: 'processando' },
    update: { status: 'processando', erroMsg: null },
  })

  try {
    const out = await gerarECF({
      workspaceId: scope.workspaceId,
      anoFiscal,
      empresa: {
        razaoSocial: empresaDB.razaoSocial,
        cnpj: (empresaDB.cnpj ?? cfg.cnpjEmissor).replace(/\D/g, ''),
        uf: empresaDB.uf ?? 'RS',
        inscricaoEstadual: empresaDB.inscricaoEstadual ?? cfg.inscricaoEstadual,
        codigoMunicipioIBGE: null,
      },
      formaTributacao: forma,
      dadosDRE,
      apuracoesTrimestrais,
      atividadesIncentivadas,
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
    return NextResponse.json({ error: 'Falha ao gerar ECF', detalhe: err?.message }, { status: 500 })
  }
}
