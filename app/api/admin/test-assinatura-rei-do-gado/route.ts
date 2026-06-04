/**
 * Endpoint TEMPORÁRIO — testa fluxo de assinatura nativa.
 * Localiza proposta "Rei do Gado", cria contrato (se faltar) e envia
 * para assinatura com Gustavo como signatário.
 * Remover após o teste.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveContent,
  type RenderContext,
  type ProductInfo,
} from '@/lib/contratos/render-template'
import { renderTemplateToPdfBuffer } from '@/lib/contratos/pdf-renderer'
import { getSignatureProvider } from '@/lib/contratos/signature'
import { notifySignatario } from '@/lib/contratos/signature/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.profitsync.ia.br'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // 1. Encontrar proposta "Rei do Gado"
    const proposta = await db.proposta.findFirst({
      where: {
        OR: [
          { cliente: { nome: { contains: 'Rei do Gado', mode: 'insensitive' } } },
          { cliente: { nome: { contains: 'rei do gado', mode: 'insensitive' } } },
        ],
      },
      include: { cliente: true, contratos: { take: 1, orderBy: { criadoEm: 'desc' } } },
      orderBy: { criadaEm: 'desc' },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'proposta_rei_do_gado_nao_encontrada' }, { status: 404 })
    }

    const workspaceId = proposta.workspaceId

    // 2. Criar contrato se não existir
    let contrato = proposta.contratos?.[0]
      ? await db.contrato.findUnique({
          where: { id: proposta.contratos[0].id },
          include: { cliente: true, proposta: true, assinaturaDigital: true },
        })
      : null

    if (!contrato) {
      const numero = `CT-${Date.now().toString(36).toUpperCase()}`
      contrato = (await db.contrato.create({
        data: {
          numero,
          proposIdFk: proposta.id,
          clienteId: proposta.clienteId,
          workspaceId,
          dataInicio: new Date(),
          statusAssinatura: 'pendente',
          modalidade: 'fixo',
        },
        include: { cliente: true, proposta: true, assinaturaDigital: true },
      })) as any
    }

    // 3. Cancelar coleta anterior se houver
    if (contrato!.assinaturaDigital && contrato!.assinaturaDigital.status !== 'cancelado') {
      if (contrato!.assinaturaDigital.status === 'assinado') {
        return NextResponse.json({
          erro: 'contrato_ja_assinado',
          contratoId: contrato!.id,
          assinaturaId: contrato!.assinaturaDigital.id,
        }, { status: 409 })
      }
      await db.assinaturaDigital.update({
        where: { id: contrato!.assinaturaDigital.id },
        data: { status: 'cancelado' },
      })
    }

    // 4. Resolver template
    const template =
      (await db.contratoTemplate.findFirst({
        where: { workspaceId, ativo: true, isDefault: true, tipo: proposta.tipo },
      })) ||
      (await db.contratoTemplate.findFirst({
        where: { workspaceId, ativo: true },
        orderBy: { updatedAt: 'desc' },
      }))
    if (!template) {
      return NextResponse.json({ error: 'no_template_available' }, { status: 400 })
    }

    const empresa = await db.dadosEmpresa.findUnique({ where: { workspaceId } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graos: any[] = (proposta.graos as any) ?? []
    let produto: ProductInfo | undefined
    if (Array.isArray(graos) && graos.length > 0) {
      const g = graos[0]
      produto = {
        grao: String(g.grao ?? ''),
        quantidade: Number(g.quantidade ?? 0),
        preco: Number(g.preco ?? 0),
        subtotal: Number(g.subtotal ?? 0),
        unidade: String(g.unidade ?? 't'),
      }
    }

    const ctx: RenderContext = {
      empresa,
      cliente: contrato!.cliente,
      contrato: contrato as any,
      produto,
    }
    const resolved = resolveContent(template.contentJson, ctx)

    const itensGrao = Array.isArray(graos)
      ? graos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      documentTitle: `Contrato ${contrato!.numero}`,
    })) as Buffer
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // 5. Provider.send com Gustavo
    const provider = await getSignatureProvider(workspaceId)
    const webhookSecret = crypto.randomBytes(24).toString('hex')

    const signatarios = [
      {
        nome: 'Gustavo',
        cpfCnpj: '00000000000', // placeholder — Gustavo digita o real ao assinar
        email: 'aero.gus@hotmail.com',
        telefone: '51997904545',
        authMode: 'simple' as const,
      },
    ]

    const sendResp = await provider.send({
      contractId: contrato!.id,
      contractNumber: contrato!.numero,
      pdfBuffer,
      pdfFileName: `Contrato-${contrato!.numero}.pdf`,
      pdfHash,
      signatories: signatarios.map((s) => ({
        name: s.nome,
        cpfCnpj: s.cpfCnpj,
        email: s.email,
        phone: s.telefone,
        authMode: s.authMode,
      })),
      externalId: contrato!.id,
      webhookUrl: `${APP_URL}/api/webhooks/signature/${provider.name}?ws=${workspaceId}`,
    })

    if (!sendResp.ok) {
      return NextResponse.json({ error: 'provider_failed', message: sendResp.error }, { status: 502 })
    }

    const tokenHashes: Array<string | null> =
      provider.name === 'native' && Array.isArray(sendResp.rawResponse?.tokens)
        ? (sendResp.rawResponse.tokens as Array<{ tokenHash?: string }>).map((t) => t?.tokenHash ?? null)
        : signatarios.map(() => null)

    await db.$transaction(async (tx) => {
      // Delete previous if cancelled (unique constraint per contratoId)
      await tx.assinaturaDigital.deleteMany({
        where: { contratoId: contrato!.id, status: 'cancelado' },
      })
      await tx.assinaturaDigital.create({
        data: {
          workspaceId,
          contratoId: contrato!.id,
          providerNome: provider.name,
          providerDocId: sendResp.providerDocId,
          authMode: 'simple',
          status: 'pendente',
          enviadoEm: new Date(),
          signatarios: signatarios.map((s, i) => ({
            ordem: i,
            nome: s.nome,
            name: s.nome,
            cpfCnpj: s.cpfCnpj,
            email: s.email,
            telefone: s.telefone,
            phone: s.telefone,
            authMode: s.authMode,
            signedAt: null,
            refusedAt: null,
            ip: null,
            tokenHash: tokenHashes[i] ?? null,
            signUrl: sendResp.signUrls[i]?.url ?? null,
          })),
          pdfOriginalHash: pdfHash,
          webhookSecret,
        },
      })
      await tx.contrato.update({
        where: { id: contrato!.id },
        data: {
          statusAssinatura: 'enviada',
          pdfHash,
          pdfHashedAt: new Date(),
        },
      })
    })

    // 6. Notificar Gustavo
    const brandNome = empresa?.nomeFantasia || empresa?.razaoSocial || undefined
    const notif = await notifySignatario({
      contratoNumero: contrato!.numero,
      brandNome,
      signatario: {
        nome: 'Gustavo',
        email: 'aero.gus@hotmail.com',
        telefone: '51997904545',
        url: sendResp.signUrls[0]?.url ?? '',
      },
    })

    return NextResponse.json({
      ok: true,
      proposta: { id: proposta.id, numero: proposta.numero, clienteNome: proposta.cliente.nome },
      contrato: { id: contrato!.id, numero: contrato!.numero, statusAssinatura: 'enviada' },
      providerDocId: sendResp.providerDocId,
      provider: provider.name,
      signUrl: sendResp.signUrls[0]?.url,
      notificacao: notif,
    })
  } catch (e: any) {
    console.error('[test-assinatura-rei-do-gado]', e)
    return NextResponse.json({ error: e?.message ?? 'internal_error', stack: e?.stack }, { status: 500 })
  }
}
