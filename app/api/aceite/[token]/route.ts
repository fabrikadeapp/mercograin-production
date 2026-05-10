/**
 * Endpoint PÚBLICO (sem auth) — retorna dados mínimos do contrato pra produtor revisar.
 * Token é a credencial; validação timing-safe + hash lookup no DB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validarTokenAceite, hashToken } from '@/lib/contratos/aceite'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  const { contratoId, valid } = validarTokenAceite(token)
  if (!valid) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const aceite = await db.aceiteContrato.findUnique({
    where: { tokenHash },
    include: {
      contrato: {
        include: {
          cliente: { select: { nome: true, cpf: true, cnpj: true } },
          proposta: {
            select: { numero: true, graos: true, valorTotal: true, tipo: true },
          },
          workspace: { select: { name: true } },
        },
      },
    },
  })
  if (!aceite || aceite.contratoId !== contratoId) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // Expiração
  const now = new Date()
  if (aceite.status === 'pendente' && aceite.expiraEm < now) {
    await db.aceiteContrato.update({
      where: { id: aceite.id },
      data: { status: 'expirado' },
    })
    return NextResponse.json({ error: 'Link expirado', status: 'expirado' }, { status: 410 })
  }

  return NextResponse.json({
    status: aceite.status,
    aceitoEm: aceite.aceitoEm,
    expiraEm: aceite.expiraEm,
    contrato: {
      numero: aceite.contrato.numero,
      dataInicio: aceite.contrato.dataInicio,
      dataFim: aceite.contrato.dataFim,
      modalidade: aceite.contrato.modalidade,
      pdfUrl: aceite.contrato.pdfUrl,
      pdfHash: aceite.contrato.pdfHash,
      cliente: aceite.contrato.cliente
        ? { nome: aceite.contrato.cliente.nome }
        : null,
      proposta: aceite.contrato.proposta,
      corretora: aceite.contrato.workspace?.name ?? null,
    },
  })
}
