/**
 * GET /api/portal/perfil   → retorna cadastro completo do cliente logado
 * PATCH /api/portal/perfil → atualiza campos do cadastro
 *
 * Requer sessão de portal-produtor (cookie bh_portal_session).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const patchSchema = z.object({
  nomeCompleto: z.string().min(3).max(255).optional(),
  cpfCnpj: z.string().min(11).max(20).optional(),
  rg: z.string().max(30).optional(),
  nomePai: z.string().max(255).optional(),
  nomeMae: z.string().max(255).optional(),
  profissao: z.string().max(120).optional(),
  nacionalidade: z.string().max(80).optional(),
  cargoEmpresa: z.string().max(120).optional(),
  telefone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  enderecoCep: z.string().max(12).optional(),
  enderecoLogradouro: z.string().max(255).optional(),
  enderecoNumero: z.string().max(20).optional(),
  enderecoComplemento: z.string().max(120).optional(),
  enderecoBairro: z.string().max(120).optional(),
  enderecoCidade: z.string().max(120).optional(),
  enderecoUf: z.string().length(2).optional(),
})

const OBRIGATORIOS: Array<keyof z.infer<typeof patchSchema>> = [
  'nomeCompleto',
  'cpfCnpj',
  'rg',
  'nomePai',
  'nomeMae',
  'profissao',
  'nacionalidade',
  'telefone',
  'whatsapp',
  'enderecoCep',
  'enderecoLogradouro',
  'enderecoNumero',
  'enderecoBairro',
  'enderecoCidade',
  'enderecoUf',
]

export async function GET() {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const access = await db.produtorAccess.findUnique({
    where: { id: session.accessId },
    include: { cliente: { select: { nome: true, email: true, cnpj: true } } },
  })
  if (!access) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const faltando = OBRIGATORIOS.filter((k) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (access as any)[k]
    return v == null || (typeof v === 'string' && v.trim() === '')
  })

  return NextResponse.json({
    ok: true,
    perfil: {
      emailLogin: access.emailLogin,
      nomeCompleto: access.nomeCompleto,
      cpfCnpj: access.cpfCnpj,
      rg: access.rg,
      nomePai: access.nomePai,
      nomeMae: access.nomeMae,
      profissao: access.profissao,
      nacionalidade: access.nacionalidade,
      cargoEmpresa: access.cargoEmpresa,
      telefone: access.telefone,
      whatsapp: access.whatsapp,
      enderecoCep: access.enderecoCep,
      enderecoLogradouro: access.enderecoLogradouro,
      enderecoNumero: access.enderecoNumero,
      enderecoComplemento: access.enderecoComplemento,
      enderecoBairro: access.enderecoBairro,
      enderecoCidade: access.enderecoCidade,
      enderecoUf: access.enderecoUf,
      perfilCompletoEm: access.perfilCompletoEm,
    },
    cliente: access.cliente,
    obrigatoriosFaltando: faltando,
    completo: faltando.length === 0,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Normaliza CPF/CNPJ e UF
  const norm = { ...data }
  if (norm.cpfCnpj) norm.cpfCnpj = norm.cpfCnpj.replace(/\D/g, '')
  if (norm.enderecoUf) norm.enderecoUf = norm.enderecoUf.toUpperCase()
  if (norm.enderecoCep) norm.enderecoCep = norm.enderecoCep.replace(/\D/g, '')
  if (norm.telefone) norm.telefone = norm.telefone.replace(/\D/g, '')
  if (norm.whatsapp) norm.whatsapp = norm.whatsapp.replace(/\D/g, '')

  const before = await db.produtorAccess.findUnique({
    where: { id: session.accessId },
  })
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const merged = { ...before, ...norm }
  const faltando = OBRIGATORIOS.filter((k) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (merged as any)[k]
    return v == null || (typeof v === 'string' && v.trim() === '')
  })
  const completo = faltando.length === 0

  const updated = await db.produtorAccess.update({
    where: { id: session.accessId },
    data: {
      ...norm,
      perfilCompletoEm:
        completo && !before.perfilCompletoEm ? new Date() : undefined,
    },
  })

  await logAudit({
    userId: 'portal-produtor',
    workspaceId: session.workspaceId,
    acao: 'update',
    entidade: 'ProdutorAccess.perfil',
    entidadeId: session.accessId,
    mudancas: { campos: Object.keys(norm) },
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    completo,
    obrigatoriosFaltando: faltando,
    perfilCompletoEm: updated.perfilCompletoEm,
  })
}
