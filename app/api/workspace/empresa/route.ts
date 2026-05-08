import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

const empresaSchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  dadosBancarios: z.any().optional().nullable(),
})

function canEdit(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export async function GET() {
  try {
    const scope = await requireScope()
    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    })
    return NextResponse.json({ empresa })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'unauthorized' },
      { status: 401 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const scope = await requireScope()
    if (!canEdit(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => null)
    const parsed = empresaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'invalid' },
        { status: 400 }
      )
    }
    const data = parsed.data
    const empresa = await db.dadosEmpresa.upsert({
      where: { workspaceId: scope.workspaceId },
      create: { workspaceId: scope.workspaceId, ...data },
      update: data,
    })
    return NextResponse.json({ empresa })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'error' },
      { status: 500 }
    )
  }
}
