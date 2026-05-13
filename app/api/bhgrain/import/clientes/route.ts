/**
 * POST /api/bhgrain/import/clientes
 *
 * Modo preview (default) e commit (?commit=1).
 *
 * - Preview: lê o CSV, retorna mapping + validos + erros (não persiste).
 * - Commit: persiste registros válidos, pulando duplicatas (CNPJ/CPF já cadastrados).
 *
 * Requer permissão 'import_data' (gestor / admin / owner).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { db } from '@/lib/db'
import { parseClientesCsv } from '@/lib/bhgrain/clientes-import'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const scope = await requireBhGrainScope()
    scope.require('import_data')

    const url = new URL(request.url)
    const commit = url.searchParams.get('commit') === '1'

    const ct = request.headers.get('content-type') ?? ''
    let csv: string
    if (ct.includes('multipart/form-data')) {
      const fd = await request.formData()
      const file = fd.get('file')
      if (!(file instanceof Blob)) throw new Error('Arquivo CSV obrigatório')
      if (file.size > MAX_SIZE) throw new Error('Arquivo excede 5 MB')
      csv = await file.text()
    } else {
      const body = await request.text()
      if (body.length > MAX_SIZE) throw new Error('Conteúdo excede 5 MB')
      csv = body
    }

    const preview = parseClientesCsv(csv)

    if (!commit) {
      return NextResponse.json({
        commit: false,
        total: preview.total,
        validosCount: preview.validos.length,
        errosCount: preview.erros.length,
        mapping: preview.mapping,
        sample: preview.validos.slice(0, 10),
        erros: preview.erros.slice(0, 50),
      })
    }

    // COMMIT: persiste em chunks. Skip duplicates por CNPJ/CPF/email.
    const cnpjs = preview.validos.map((v) => v.cnpj).filter((c): c is string => !!c)
    const cpfs = preview.validos.map((v) => v.cpf).filter((c): c is string => !!c)
    const existentes = await db.cliente.findMany({
      where: {
        workspaceId: scope.workspaceId,
        OR: [
          cnpjs.length > 0 ? { cnpj: { in: cnpjs } } : { id: '__nope__' },
          cpfs.length > 0 ? { cpf: { in: cpfs } } : { id: '__nope__' },
        ],
      },
      select: { cnpj: true, cpf: true },
    })
    const cnpjExistentes = new Set(existentes.map((e) => e.cnpj).filter(Boolean))
    const cpfExistentes = new Set(existentes.map((e) => e.cpf).filter(Boolean))

    const aInserir = preview.validos.filter((v) => {
      if (v.cnpj && cnpjExistentes.has(v.cnpj)) return false
      if (v.cpf && cpfExistentes.has(v.cpf)) return false
      return true
    })
    const pulados = preview.validos.length - aInserir.length

    let inseridos = 0
    if (aInserir.length > 0) {
      // createMany — Prisma é eficiente em batch
      const res = await db.cliente.createMany({
        data: aInserir.map((v) => ({
          workspaceId: scope.workspaceId,
          nome: v.nome,
          tipo: v.tipo,
          email: v.email,
          whatsapp: v.whatsapp,
          telefone: v.telefone,
          cnpj: v.cnpj,
          cpf: v.cpf,
          endereco: v.endereco,
          tipoPessoa: v.cnpj ? 'PJ' : v.cpf ? 'PF' : null,
          statusCadastral: 'aprovado',
        })),
        skipDuplicates: true,
      })
      inseridos = res.count
    }

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'Importação CSV de clientes',
        entidade: 'Cliente',
        entidadeId: `batch:${Date.now()}`,
        workspaceId: scope.workspaceId,
        mudancas: { total: preview.total, inseridos, pulados, errosCount: preview.erros.length },
      },
    })

    return NextResponse.json({
      commit: true,
      total: preview.total,
      validos: preview.validos.length,
      inseridos,
      pulados,
      errosCount: preview.erros.length,
      erros: preview.erros.slice(0, 50),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg.includes('autoriz') ? 401 : msg.includes('Acesso') ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
