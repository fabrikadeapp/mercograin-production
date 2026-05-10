import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProvider } from '@/lib/fiscal/providers'

const configSchema = z.object({
  cnpjEmissor: z.string().min(14).max(18),
  inscricaoEstadual: z.string().optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  regimeTributario: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']),
  cnae: z.string().optional().nullable(),
  providerNome: z.enum(['mock', 'nfeio', 'enotas', 'webmania', 'tecnospeed']).default('mock'),
  providerCompanyId: z.string().optional().nullable(),
  ambiente: z.enum(['homologacao', 'producao']).default('homologacao'),
  certificadoUrl: z.string().optional().nullable(),
  certificadoVencimento: z.string().optional().nullable(),
  certificadoAlias: z.string().optional().nullable(),
  serieNFe: z.number().int().positive().default(1),
  proximoNumeroNFe: z.number().int().positive().default(1),
  serieNFeContingencia: z.number().int().positive().optional().nullable(),
  cfopCompraProdutorPF: z.string().default('1102'),
  cfopCompraProdutorPJ: z.string().default('1102'),
  cfopVendaInterestadual: z.string().default('6101'),
  cfopVendaIntraestadual: z.string().default('5101'),
  funruralAplicar: z.boolean().default(true),
  funruralAliquota: z.number().nonnegative().default(1.3),
  cnaeSped: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const cfg = await db.configuracaoFiscal.findUnique({
    where: { workspaceId: scope.workspaceId },
  })
  return NextResponse.json({ data: cfg })
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!scope.isWorkspaceOwner && scope.workspaceRole !== 'admin') {
    return NextResponse.json({ error: 'Apenas owner/admin pode editar config fiscal' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = configSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const cfg = await db.configuracaoFiscal.upsert({
    where: { workspaceId: scope.workspaceId },
    create: { workspaceId: scope.workspaceId, ...data, certificadoVencimento: data.certificadoVencimento ? new Date(data.certificadoVencimento) : null },
    update: { ...data, certificadoVencimento: data.certificadoVencimento ? new Date(data.certificadoVencimento) : null },
  })

  return NextResponse.json({ data: cfg })
}

export async function POST(request: NextRequest) {
  // Endpoint utilitário: testar conexão com provider configurado
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.acao !== 'testar_conexao') {
    return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 })
  }
  const provider = await getProvider(scope.workspaceId)
  const r = await provider.testarConexao()
  return NextResponse.json({ provider: provider.nome, ...r })
}
