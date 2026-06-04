/**
 * GET  /api/assinar/[token]  — retorna metadata + PDF do contrato
 * POST /api/assinar/[token]  — registra assinatura
 *
 * Sem auth — token é a credencial.
 * Vide docs/specs/assinaturapropriaonline.md §6.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { validarTokenAssinatura } from '@/lib/contratos/signature/native-token'
import { generateContratoPDFStream } from '@/lib/pdf-service'
import { notifyStaffConcluido } from '@/lib/contratos/signature/notify'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SignatarioInfo {
  nome?: string
  name?: string
  cpfCnpj?: string
  email?: string
  telefone?: string
  phone?: string
  tokenHash?: string
  signedAt?: string
  refusedAt?: string
  ip?: string | null
  ua?: string | null
  acceptLanguage?: string | null
  authMode?: string
  [k: string]: unknown
}

async function carregarAssinatura(token: string) {
  const v = validarTokenAssinatura(token)
  if (!v.valid) {
    return {
      erro: v.expirado ? 'expirado' : 'invalido',
      status: 403 as const,
    }
  }

  // assinaturaId vinda do token é o providerDocId (ex: 'native:abcd1234')
  const a = await db.assinaturaDigital.findUnique({
    where: { providerDocId: v.assinaturaId },
    include: {
      contrato: {
        include: {
          cliente: {
            select: {
              nome: true,
              cnpj: true,
              email: true,
              workspaceId: true,
            },
          },
          proposta: {
            select: {
              numero: true,
              tipo: true,
              valorTotal: true,
              graos: true,
            },
          },
        },
      },
    },
  })

  if (!a) {
    return { erro: 'nao_encontrada', status: 404 as const }
  }
  if (a.status === 'cancelado') {
    return { erro: 'cancelada', status: 410 as const }
  }

  const signatarios: SignatarioInfo[] = Array.isArray(a.signatarios)
    ? (a.signatarios as SignatarioInfo[])
    : []
  const idx = v.signatorioIdx
  if (idx < 0 || idx >= signatarios.length) {
    return { erro: 'signatario_invalido', status: 404 as const }
  }
  const signatario = signatarios[idx]

  // Validação de tokenHash persistido (defesa contra token forjado mesmo
  // se assinatura HMAC bater)
  if (signatario.tokenHash && signatario.tokenHash !== v.tokenHash) {
    return { erro: 'token_revogado', status: 403 as const }
  }

  return { ok: true as const, a, signatario, idx, validacao: v }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const resultado = await carregarAssinatura(params.token)
  if ('erro' in resultado) {
    return NextResponse.json(
      { erro: resultado.erro },
      { status: resultado.status }
    )
  }
  const { a, signatario, idx, validacao } = resultado

  // Se signatário já assinou, retorna recibo
  const jaAssinou = !!signatario.signedAt

  // Decide se vai retornar PDF (param ?pdf=1) ou metadata JSON
  const { searchParams } = new URL(request.url)
  const querPDF = searchParams.get('pdf') === '1'

  if (querPDF) {
    // Renderiza PDF do contrato + dados reais
    const c = a.contrato
    const graos = Array.isArray(c.proposta?.graos)
      ? (c.proposta.graos as Array<{
          grao: string
          quantidade: number
          preco: number
          subtotal: number
        }>)
      : []

    const pdfBuffer = await generateContratoPDFStream({
      numero: c.numero,
      propostaNumero: c.proposta?.numero ?? '—',
      propostaValor: c.proposta?.valorTotal ?? 0,
      statusAssinatura: c.statusAssinatura,
      clienteNome: c.cliente?.nome ?? '—',
      clienteCNPJ: c.cliente?.cnpj || undefined,
      clienteEmail: c.cliente?.email || undefined,
      dataInicio: c.dataInicio,
      dataFim: c.dataFim ?? undefined,
      graos,
      criadoEm: c.criadoEm,
    })

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Contrato-${c.numero}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  // Metadata JSON (para a página de assinatura)
  const totalSignatarios = Array.isArray(a.signatarios)
    ? (a.signatarios as SignatarioInfo[]).length
    : 0
  const totalAssinados = Array.isArray(a.signatarios)
    ? (a.signatarios as SignatarioInfo[]).filter((s) => s.signedAt).length
    : 0

  return NextResponse.json({
    ok: true,
    contrato: {
      numero: a.contrato.numero,
      clienteNome: a.contrato.cliente?.nome,
      propostaNumero: a.contrato.proposta?.numero,
      valor: a.contrato.proposta?.valorTotal,
    },
    signatario: {
      nome: signatario.nome ?? signatario.name,
      email: signatario.email,
      cpfCnpj: signatario.cpfCnpj,
      authMode: signatario.authMode ?? a.authMode,
      jaAssinou,
      assinadoEm: signatario.signedAt ?? null,
    },
    assinatura: {
      status: a.status,
      totalSignatarios,
      totalAssinados,
      expiraEm: validacao.expiraEm?.toISOString(),
    },
  })
}

const POST_SCHEMA = z.object({
  /** Nome completo do signatário no momento da assinatura. */
  nomeCompleto: z.string().min(5).max(200),
  /** CPF ou CNPJ — só dígitos. */
  cpfCnpj: z.string().min(11).max(20),
  /** Confirmação obrigatória de leitura. */
  liEConcordo: z.boolean(),
  /** Geo opcional (cliente envia se permitir). */
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const resultado = await carregarAssinatura(params.token)
    if ('erro' in resultado) {
      return NextResponse.json(
        { erro: resultado.erro },
        { status: resultado.status }
      )
    }
    const { a, signatario, idx } = resultado

    if (signatario.signedAt) {
      return NextResponse.json(
        { erro: 'ja_assinou', signedAt: signatario.signedAt },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const data = POST_SCHEMA.parse(body)

    if (!data.liEConcordo) {
      return NextResponse.json(
        { erro: 'consentimento_obrigatorio' },
        { status: 400 }
      )
    }

    // Normaliza CPF/CNPJ — só dígitos
    const cpfCnpjNorm = data.cpfCnpj.replace(/\D/g, '')

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      null
    const ua = request.headers.get('user-agent')?.slice(0, 200) ?? null
    const acceptLanguage =
      request.headers.get('accept-language')?.slice(0, 80) ?? null
    const signedAt = new Date()

    // Atualiza array signatarios
    const todos: SignatarioInfo[] = Array.isArray(a.signatarios)
      ? [...(a.signatarios as SignatarioInfo[])]
      : []

    todos[idx] = {
      ...todos[idx],
      nome: data.nomeCompleto,
      cpfCnpj: cpfCnpjNorm,
      signedAt: signedAt.toISOString(),
      ip,
      ua,
      acceptLanguage,
      ...(data.geo
        ? {
            geo: {
              lat: Math.round(data.geo.lat * 10000) / 10000,
              lng: Math.round(data.geo.lng * 10000) / 10000,
            },
          }
        : {}),
    }

    const totalSignatarios = todos.length
    const totalAssinados = todos.filter((s) => s.signedAt).length
    const todosAssinaram = totalAssinados >= totalSignatarios

    // Hash do PDF (do contrato atual — captura "o que ele viu/assinou")
    let pdfHash: string | null = null
    try {
      const c = a.contrato
      const graos = Array.isArray(c.proposta?.graos)
        ? (c.proposta.graos as Array<{
            grao: string
            quantidade: number
            preco: number
            subtotal: number
          }>)
        : []
      const pdfBuffer = await generateContratoPDFStream({
        numero: c.numero,
        propostaNumero: c.proposta?.numero ?? '—',
        propostaValor: c.proposta?.valorTotal ?? 0,
        statusAssinatura: c.statusAssinatura,
        clienteNome: c.cliente?.nome ?? '—',
        clienteCNPJ: c.cliente?.cnpj || undefined,
        clienteEmail: c.cliente?.email || undefined,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim ?? undefined,
        graos,
        criadoEm: c.criadoEm,
      })
      pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
    } catch {
      /* hash é nice-to-have, não bloqueia */
    }

    await db.assinaturaDigital.update({
      where: { id: a.id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signatarios: todos as any,
        status: todosAssinaram ? 'assinado' : 'parcial',
        finalizadoEm: todosAssinaram ? signedAt : null,
        pdfAssinadoHash: todosAssinaram ? pdfHash : null,
        pdfOriginalHash: a.pdfOriginalHash ?? pdfHash,
      },
    })

    if (todosAssinaram) {
      await db.contrato.update({
        where: { id: a.contratoId },
        data: {
          statusAssinatura: 'assinado',
          assinadoEm: signedAt,
          pdfHash,
          pdfHashedAt: signedAt,
        },
      })
    }

    // Notifica staff quando todos assinaram
    if (todosAssinaram) {
      try {
        const empresa = await db.dadosEmpresa.findFirst({
          where: { workspaceId: a.workspaceId },
          select: { razaoSocial: true, nomeFantasia: true, email: true },
        })
        // Destinatários staff: admins/owners do workspace + email institucional
        const staffUsers = await db.user.findMany({
          where: {
            workspaceMemberships: {
              some: {
                workspaceId: a.workspaceId,
                role: { in: ['owner', 'admin'] },
              },
            },
          },
          select: { email: true },
        })
        const emailsStaff = Array.from(
          new Set(
            [
              ...staffUsers.map((u) => u.email),
              empresa?.email,
            ].filter(Boolean) as string[],
          ),
        )
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXTAUTH_URL ||
          ''
        await notifyStaffConcluido({
          emails: emailsStaff,
          contratoNumero: a.contrato.numero,
          clienteNome: a.contrato.cliente?.nome ?? '—',
          brandNome:
            empresa?.nomeFantasia || empresa?.razaoSocial || undefined,
          totalSignatarios,
          linkInternoContrato: appUrl
            ? `${appUrl}/contratos/${a.contratoId}`
            : undefined,
        }).catch((err) => {
          console.error('[POST assinar] notify staff falhou:', err)
        })
      } catch (err) {
        console.error('[POST assinar] coleta destinatários staff falhou:', err)
      }
    }

    // Audit log
    await db.auditLog
      .create({
        data: {
          userId: 'public_signer',
          workspaceId: a.workspaceId,
          acao: todosAssinaram ? 'contrato_assinado_completo' : 'contrato_assinado_parcial',
          entidade: 'contrato',
          entidadeId: a.contratoId,
          mudancas: {
            numero: a.contrato.numero,
            signatarioIdx: idx,
            signatarioNome: data.nomeCompleto,
            ip,
            ua,
            totalSignatarios,
            totalAssinados,
          },
        },
      })
      .catch(() => undefined)

    return NextResponse.json({
      ok: true,
      todosAssinaram,
      totalAssinados,
      totalSignatarios,
      assinadoEm: signedAt.toISOString(),
      protocolo: a.providerDocId,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ erro: err.errors[0].message }, { status: 400 })
    }
    console.error('POST assinar error:', err)
    return NextResponse.json({ erro: 'erro_interno' }, { status: 500 })
  }
}
