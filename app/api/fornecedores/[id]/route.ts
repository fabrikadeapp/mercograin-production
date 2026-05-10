import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCNPJ } from '@/lib/br/documento'

const TIPO_ENUM = z.enum([
  'transportadora',
  'armazem',
  'insumos',
  'certificadora',
  'outros',
])

const fornecedorUpdateSchema = z.object({
  tipo: TIPO_ENUM.optional(),
  razaoSocial: z.string().min(2).optional(),
  nomeFantasia: z.string().optional().nullable(),
  cnpj: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.length === 0 || isValidCNPJ(v), {
      message: 'CNPJ inválido',
    }),
  contato: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  metadata: z.record(z.any()).optional().nullable(),
})

// GET - detalhe
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const fornecedor = await db.fornecedor.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!fornecedor) {
      return NextResponse.json(
        { error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(fornecedor)
  } catch (error) {
    console.error('Get fornecedor error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar fornecedor' },
      { status: 500 }
    )
  }
}

// PUT - atualiza
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const existing = await db.fornecedor.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = fornecedorUpdateSchema.parse(body)

    const updated = await db.fornecedor.update({
      where: { id: params.id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        metadata:
          data.metadata === undefined ? undefined : (data.metadata as any),
      } as any,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Update fornecedor error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar fornecedor' },
      { status: 500 }
    )
  }
}

// DELETE - remove
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const existing = await db.fornecedor.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    await db.fornecedor.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Fornecedor removido com sucesso' })
  } catch (error) {
    console.error('Delete fornecedor error:', error)
    return NextResponse.json(
      { error: 'Erro ao remover fornecedor' },
      { status: 500 }
    )
  }
}
