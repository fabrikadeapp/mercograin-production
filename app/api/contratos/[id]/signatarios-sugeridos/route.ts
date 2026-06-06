/**
 * GET /api/contratos/[id]/signatarios-sugeridos
 * Retorna os melhores candidatos a signatário do contrato, com prioridade:
 *  1. ProdutorAccess do cliente (perfil completo: nome, CPF, email, telefone)
 *  2. Cliente (fallback: nome, cnpj, email, whatsapp)
 *
 * Usado pelo modal "Enviar para assinatura" para preencher tudo em 1 clique.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const contrato = await db.contrato.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: {
      id: true,
      clienteId: true,
      cliente: {
        select: {
          nome: true,
          email: true,
          whatsapp: true,
          telefone: true,
          cnpj: true,
          cpf: true,
          tipoPessoa: true,
        },
      },
    },
  })
  if (!contrato) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // ProdutorAccess pode ter o perfil mais recente do representante legal
  const pa = await db.produtorAccess.findFirst({
    where: { clienteId: contrato.clienteId, ativo: true },
    select: {
      nomeCompleto: true,
      cpfCnpj: true,
      emailLogin: true,
      telefone: true,
      whatsapp: true,
      perfilCompletoEm: true,
    },
    orderBy: { perfilCompletoEm: 'desc' },
  })

  const c = contrato.cliente
  const sugestoes = [
    {
      ordem: 0,
      name:
        pa?.nomeCompleto ||
        c?.nome ||
        '',
      cpfCnpj:
        pa?.cpfCnpj ||
        c?.cpf ||
        c?.cnpj ||
        '',
      email: pa?.emailLogin || c?.email || '',
      phone: pa?.whatsapp || pa?.telefone || c?.whatsapp || c?.telefone || '',
      authMode: 'simple' as const,
      origem: pa ? 'produtor_access' : 'cliente',
    },
  ]
  return NextResponse.json({ ok: true, sugestoes })
}
