/**
 * TEMPORÁRIO — re-envia coleta de assinatura ao Gustavo.
 * Authorization: Bearer ${CRON_SECRET}
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

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const proposta = await db.proposta.findFirst({
      where: { cliente: { nome: { contains: 'rei do gado', mode: 'insensitive' } } },
      include: {
        cliente: true,
        contratos: { take: 1, orderBy: { criadoEm: 'desc' } },
      },
      orderBy: { criadaEm: 'desc' },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'proposta_nao_encontrada' }, { status: 404 })
    }

    const workspaceId = proposta.workspaceId

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

    if (contrato!.assinaturaDigital && contrato!.assinaturaDigital.status !== 'cancelado') {
      if (contrato!.assinaturaDigital.status === 'assinado') {
        return NextResponse.json({
          erro: 'contrato_ja_assinado',
        }, { status: 409 })
      }
      await db.assinaturaDigital.delete({
        where: { id: contrato!.assinaturaDigital.id },
      })
    } else if (contrato!.assinaturaDigital) {
      await db.assinaturaDigital.delete({
        where: { id: contrato!.assinaturaDigital.id },
      })
    }

    const template =
      (await db.contratoTemplate.findFirst({
        where: { workspaceId, ativo: true, isDefault: true, tipo: proposta.tipo },
      })) ||
      (await db.contratoTemplate.findFirst({
        where: { workspaceId, ativo: true },
        orderBy: { updatedAt: 'desc' },
      }))
    if (!template) {
      return NextResponse.json({ error: 'no_template' }, { status: 400 })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? graos.map((g: any) => {
          const unidade = String(g?.unidade ?? 't').toLowerCase()
          const qtdRaw = Number(g?.quantidade ?? 0)
          const quantidadeSc = unidade === 't' ? qtdRaw * (1000 / 60) : qtdRaw
          return {
            grao: String(g?.grao ?? ''),
            quantidadeSc: Math.round(quantidadeSc),
            precoSc: Number(g?.preco ?? 0),
          }
        }).filter((it) => it.quantidadeSc > 0 || it.precoSc > 0)
      : []

    const pdfBuffer = (await renderTemplateToPdfBuffer(resolved, {
      customLogoUrl: empresa?.logoUrl ?? null,
      itensGrao,
      documentTitle: `Contrato ${contrato!.numero}`,
    })) as Buffer
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    const provider = await getSignatureProvider(workspaceId)
    const webhookSecret = crypto.randomBytes(24).toString('hex')

    const signatarios = [
      {
        nome: 'Gustavo',
        cpfCnpj: '00000000000',
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
    })

    if (!sendResp.ok) {
      return NextResponse.json({ error: 'provider_failed', message: sendResp.error }, { status: 502 })
    }

    if (!sendResp.signUrls[0]?.url?.startsWith('https://www.profitsync.ia.br/')) {
      return NextResponse.json({
        error: 'baseUrl_incorreto',
        signUrl: sendResp.signUrls[0]?.url,
        envNEXTAUTH_URL: process.env.NEXTAUTH_URL,
        envNEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      }, { status: 500 })
    }

    const tokenHashes: Array<string | null> =
      provider.name === 'native' && Array.isArray(sendResp.rawResponse?.tokens)
        ? (sendResp.rawResponse.tokens as Array<{ tokenHash?: string }>).map((t) => t?.tokenHash ?? null)
        : signatarios.map(() => null)

    await db.assinaturaDigital.create({
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
    await db.contrato.update({
      where: { id: contrato!.id },
      data: {
        statusAssinatura: 'enviada',
        pdfHash,
        pdfHashedAt: new Date(),
      },
    })

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
      contrato: { id: contrato!.id, numero: contrato!.numero },
      provider: provider.name,
      providerDocId: sendResp.providerDocId,
      signUrl: sendResp.signUrls[0]?.url,
      notificacao: notif,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'internal_error' }, { status: 500 })
  }
}
