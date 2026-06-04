/**
 * GET /api/propostas/share/[token]
 * Endpoint público — sem autenticação. Valida token HMAC e serve o PDF.
 *
 * Token é a credencial: timing-safe + TTL embutido.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePropostaPDFStream, PropostaPDFData } from '@/lib/pdf-service'
import { validarTokenProposta } from '@/lib/propostas/share-token'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const validacao = validarTokenProposta(params.token)
    if (!validacao.valid) {
      const motivo = validacao.expirado ? 'Link expirado' : 'Token inválido'
      return NextResponse.json({ error: motivo }, { status: 403 })
    }

    const proposta = await db.proposta.findUnique({
      where: { id: validacao.propostaId },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            endereco: true,
            workspaceId: true,
          },
        },
      },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const graos = Array.isArray(proposta.graos)
      ? (proposta.graos as Array<{
          grao: string
          quantidade: number
          preco: number
          subtotal: number
        }>)
      : []

    const pdfData: PropostaPDFData = {
      numero: proposta.numero,
      status: proposta.status,
      tipo: proposta.tipo,
      clienteNome: proposta.cliente.nome,
      clienteCNPJ: proposta.cliente.cnpj || undefined,
      clienteEmail: proposta.cliente.email || undefined,
      clienteEndereco: proposta.cliente.endereco || undefined,
      graos,
      valorTotal: proposta.valorTotal,
      descricao: proposta.descricao || undefined,
      observacoes: proposta.observacoes || undefined,
      criadaEm: proposta.criadaEm,
      validadeEm: proposta.validadeEm,
    }

    const pdfBuffer = await generatePropostaPDFStream(pdfData)

    // Log best-effort de acesso público (não bloqueia resposta)
    db.webhookLog
      .create({
        data: {
          tipo: 'proposta_share_access',
          payload: {
            propostaId: proposta.id,
            numero: proposta.numero,
            ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
            ua: request.headers.get('user-agent') ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          status: 'processado',
          mensagem: `Acesso público à proposta ${proposta.numero}`,
        },
      })
      .catch(() => undefined)

    // F3 — Marca como vista pelo cliente (primeira vez) e incrementa contador
    db.proposta
      .update({
        where: { id: proposta.id },
        data: {
          vistaEm: proposta.vistaEm ?? new Date(),
          vistasCount: { increment: 1 },
        },
      })
      .catch(() => undefined)

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Proposta-${proposta.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('Public share PDF error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF da proposta' },
      { status: 500 }
    )
  }
}
