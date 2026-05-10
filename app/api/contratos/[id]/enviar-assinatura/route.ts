/**
 * POST /api/contratos/[id]/enviar-assinatura
 *
 * Envia um contrato para assinatura digital via SignatureProvider configurado.
 *
 * Body: {
 *   signatorios: [{ nome, cpfCnpj, email, telefone?, authMode }]
 * }
 *
 * Fluxo:
 *  1. Carrega contrato e valida statusAssinatura !== 'assinado'
 *  2. Renderiza PDF (mesmo render-pdf), calcula SHA-256
 *  3. Chama provider.send()
 *  4. Cria AssinaturaDigital + atualiza Contrato.statusAssinatura='enviada'
 *  5. Audit log
 */
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import {
  resolveContent,
  type RenderContext,
  type ProductInfo,
} from '@/lib/contratos/render-template'
import { renderTemplateToPdfBuffer } from '@/lib/contratos/pdf-renderer'
import { getSignatureProvider } from '@/lib/contratos/signature'
import type { AuthMode } from '@/lib/contratos/signature'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.profitsync.ia.br'

const signatarioSchema = z.object({
  nome: z.string().min(2),
  cpfCnpj: z.string().min(11),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  authMode: z.enum(['simple', 'icp_brasil', 'sms', 'email_token']),
})

const bodySchema = z.object({
  signatorios: z.array(signatarioSchema).min(1).max(10),
  templateId: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 }
      )
    }
    const { signatorios, templateId: templateIdInput } = parsed.data

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
        proposta: true,
        assinaturaDigital: true,
      },
    })
    if (!contrato) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (contrato.statusAssinatura === 'assinado') {
      return NextResponse.json(
        { error: 'contrato_ja_assinado' },
        { status: 409 }
      )
    }
    if (contrato.assinaturaDigital && contrato.assinaturaDigital.status !== 'cancelado') {
      return NextResponse.json(
        { error: 'fluxo_de_assinatura_ja_existe', providerDocId: contrato.assinaturaDigital.providerDocId },
        { status: 409 }
      )
    }

    // 1. Resolver template + render PDF
    let template = templateIdInput
      ? await db.contratoTemplate.findFirst({
          where: { id: templateIdInput, ...scope.whereOwn() },
        })
      : null
    if (!template) {
      const tipo = contrato.proposta?.tipo
      template =
        (await db.contratoTemplate.findFirst({
          where: {
            ...scope.whereOwn(),
            ativo: true,
            isDefault: true,
            ...(tipo ? { tipo } : {}),
          },
        })) ||
        (await db.contratoTemplate.findFirst({
          where: { ...scope.whereOwn(), ativo: true },
          orderBy: { updatedAt: 'desc' },
        }))
    }
    if (!template) {
      return NextResponse.json(
        { error: 'no_template_available' },
        { status: 400 }
      )
    }

    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    })

    let produto: ProductInfo | undefined
    const graos = (contrato.proposta?.graos as any) ?? []
    if (Array.isArray(graos) && graos.length > 0) {
      const g = graos[0]
      produto = {
        grao: String(g.grao ?? ''),
        quantidade: Number(g.quantidade ?? 0),
        preco: Number(g.preco ?? 0),
        subtotal: Number(g.subtotal ?? Number(g.quantidade ?? 0) * Number(g.preco ?? 0)),
        unidade: String(g.unidade ?? 't'),
      }
    }

    const ctx: RenderContext = {
      empresa,
      cliente: contrato.cliente,
      contrato,
      produto,
    }
    const resolved = resolveContent(template.contentJson, ctx)

    const itensGrao = Array.isArray(graos)
      ? graos
          .map((g: any) => {
            const unidade = String(g?.unidade ?? 't').toLowerCase()
            const qtdRaw = Number(g?.quantidade ?? 0)
            const quantidadeSc = unidade === 't' ? qtdRaw * (1000 / 60) : qtdRaw
            return {
              grao: String(g?.grao ?? ''),
              quantidadeSc: Math.round(quantidadeSc),
              precoSc: Number(g?.preco ?? 0),
            }
          })
          .filter((it) => it.quantidadeSc > 0 || it.precoSc > 0)
      : []

    const pdfBuffer = (await renderTemplateToPdfBuffer(resolved, {
      customLogoUrl: empresa?.logoUrl ?? null,
      itensGrao,
      documentTitle: `Contrato ${contrato.numero}`,
    })) as Buffer

    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // 2. Snapshot da versão de template usada (auditoria imutável)
    const snapshotData = {
      templateId: template.id,
      versao: (template as any).versao ?? 1,
      contentJson: template.contentJson,
      capturedAt: new Date().toISOString(),
    }

    // 3. Provider.send
    const provider = await getSignatureProvider(scope.workspaceId)
    const webhookSecret = crypto.randomBytes(24).toString('hex')

    const sendResp = await provider.send({
      contractId: contrato.id,
      contractNumber: contrato.numero,
      pdfBuffer,
      pdfFileName: `Contrato-${contrato.numero}.pdf`,
      pdfHash,
      signatories: signatorios.map((s) => ({
        name: s.nome,
        cpfCnpj: s.cpfCnpj,
        email: s.email,
        phone: s.telefone,
        authMode: s.authMode as AuthMode,
      })),
      externalId: contrato.id,
      webhookUrl: `${APP_URL}/api/webhooks/signature/${provider.name}?ws=${scope.workspaceId}`,
    })

    if (!sendResp.ok) {
      return NextResponse.json(
        {
          error: 'provider_failed',
          message: sendResp.error,
          provider: provider.name,
        },
        { status: 502 }
      )
    }

    // 4. Persiste AssinaturaDigital + atualiza Contrato + snapshot
    await db.$transaction(async (tx) => {
      await tx.assinaturaDigital.create({
        data: {
          workspaceId: scope.workspaceId,
          contratoId: contrato.id,
          providerNome: provider.name,
          providerDocId: sendResp.providerDocId,
          authMode: signatorios[0].authMode,
          status: 'pendente',
          enviadoEm: new Date(),
          signatarios: signatorios.map((s, i) => ({
            ordem: i,
            name: s.nome,
            cpfCnpj: s.cpfCnpj,
            email: s.email ?? null,
            phone: s.telefone ?? null,
            authMode: s.authMode,
            signedAt: null,
            refusedAt: null,
            ip: null,
            signUrl:
              sendResp.signUrls.find((u) => u.signatoryEmail === s.email)
                ?.url ?? null,
          })),
          pdfOriginalHash: pdfHash,
          webhookSecret,
        },
      })
      await tx.contrato.update({
        where: { id: contrato.id },
        data: {
          statusAssinatura: 'enviada',
          pdfHash,
          pdfHashedAt: new Date(),
          templateVersaoSnapshot: snapshotData as any,
        } as any,
      })
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'assinatura_digital',
      entidadeId: contrato.id,
      mudancas: {
        provider: provider.name,
        providerDocId: sendResp.providerDocId,
        signatariosCount: signatorios.length,
      },
    })

    return NextResponse.json({
      ok: true,
      providerDocId: sendResp.providerDocId,
      provider: provider.name,
      signUrls: sendResp.signUrls,
      status: sendResp.status,
    })
  } catch (e: any) {
    console.error('[enviar-assinatura]', e)
    return NextResponse.json(
      { error: e?.message || 'internal_error' },
      { status: 500 }
    )
  }
}
