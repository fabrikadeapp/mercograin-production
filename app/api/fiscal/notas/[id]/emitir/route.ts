import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/fiscal/providers'
import type { NFeEmissaoPayload, NFeItemPayload } from '@/lib/fiscal/providers/types'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const nota = await db.notaFiscal.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (nota.status !== 'rascunho' && nota.status !== 'rejeitada') {
    return NextResponse.json({ error: `Nota com status '${nota.status}' não pode ser emitida` }, { status: 400 })
  }

  const [cfg, empresa] = await Promise.all([
    db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } }),
    db.dadosEmpresa.findUnique({ where: { workspaceId: scope.workspaceId } }),
  ])
  if (!cfg || !empresa) {
    return NextResponse.json({ error: 'Configuração fiscal ou dados da empresa incompletos' }, { status: 412 })
  }

  const itens = Array.isArray(nota.itens) ? (nota.itens as any[]) : []
  const itensPayload: NFeItemPayload[] = itens.map((it) => ({
    descricao: it.descricao,
    ncm: it.ncm,
    cfop: it.cfop,
    qtd: Number(it.qtd),
    unidade: it.unidade ?? 'UN',
    valorUnitario: Number(it.valorUnitario),
    valorTotal: Number(it.valorTotal),
    valorICMS: it.valorICMS,
    valorPIS: it.valorPIS,
    valorCOFINS: it.valorCOFINS,
    aliquotaICMS: it.aliquotaICMS,
    diferimentoICMS: it.diferimentoICMS,
  }))

  const payload: NFeEmissaoPayload = {
    tipo: nota.tipo as any,
    modelo: nota.modelo as '55' | '65',
    serie: nota.serie,
    numero: nota.numero,
    naturezaOperacao: nota.naturezaOperacao,
    finalidadeEmissao: nota.finalidadeEmissao as any,
    ambiente: (cfg.ambiente as 'homologacao' | 'producao') || 'homologacao',
    emitente: {
      cnpj: cfg.cnpjEmissor,
      nome: empresa.razaoSocial,
      uf: empresa.uf ?? 'RS',
      inscricaoEstadual: cfg.inscricaoEstadual ?? undefined,
      regimeTributario: cfg.regimeTributario,
    },
    destinatario: {
      doc: nota.destinatarioDoc,
      nome: nota.destinatarioNome,
      uf: nota.destinatarioUF,
      inscricaoEstadual: nota.destinatarioIE ?? undefined,
    },
    itens: itensPayload,
    totais: {
      valorProdutos: Number(nota.valorProdutos),
      valorICMS: Number(nota.valorICMS),
      valorPIS: Number(nota.valorPIS),
      valorCOFINS: Number(nota.valorCOFINS),
      valorFrete: Number(nota.valorFrete),
      valorOutros: Number(nota.valorOutros),
      valorTotal: Number(nota.valorTotal),
    },
    observacoes: nota.observacoes ?? undefined,
  }

  const provider = await getProvider(scope.workspaceId)
  const r = await provider.emitirNFe(payload)

  const updated = await db.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: r.status,
      chave: r.chave ?? null,
      protocolo: r.protocolo ?? null,
      motivoRejeicao: r.motivoRejeicao ?? null,
      dataAutorizacao: r.status === 'autorizada' ? new Date() : null,
      providerResponse: r.raw ?? undefined,
      providerNFeId: r.providerNFeId ?? null,
      xmlUrl: r.xmlUrl ?? null,
      danfeUrl: r.danfeUrl ?? null,
      emitenteNome: empresa.razaoSocial,
      emitenteUF: empresa.uf ?? 'RS',
    },
  })

  return NextResponse.json({ data: updated, provider: provider.nome, providerResult: r })
}
