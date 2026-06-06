/**
 * TEMPORÁRIO — cria contrato novo + envia email para aero.gus@hotmail.com.
 * Inclui logo PNG da Mercograin + bloco de assinatura prévia do staff.
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
import { nextNumber } from '@/lib/numbering/next-number'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const ws = await db.workspace.findUnique({
    where: { slug: 'mercograin' },
    include: { empresa: true, owner: { select: { id: true, nome: true, email: true } } },
  })
  if (!ws) return NextResponse.json({ error: 'no_workspace' }, { status: 404 })

  const cliente = await db.cliente.findFirst({
    where: { workspaceId: ws.id, nome: { contains: 'rei do gado', mode: 'insensitive' } },
  })
  if (!cliente) return NextResponse.json({ error: 'no_cliente' }, { status: 404 })

  // Cria proposta + contrato novos
  const numero = await nextNumber(ws.id, 'proposta')
  const qtd = 800
  const preco = 1520
  const subtotal = qtd * preco
  const proposta = await db.proposta.create({
    data: {
      numero,
      clienteId: cliente.id,
      workspaceId: ws.id,
      tipo: 'venda',
      graos: [{ grao: 'soja', quantidade: qtd, unidade: 't', preco, subtotal }],
      valorTotal: String(subtotal),
      status: 'aceita',
      descricao: 'Contrato com logo PNG real da Mercograin + assinatura prévia da corretora',
      validadeEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      validadeCotacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      canalAutorizacao: 'web',
      origem: 'smoke',
    },
  })
  const numeroCT = await nextNumber(ws.id, 'contrato')
  const contrato = await db.contrato.create({
    data: {
      numero: numeroCT,
      proposIdFk: proposta.id,
      clienteId: cliente.id,
      workspaceId: ws.id,
      dataInicio: new Date(),
      statusAssinatura: 'pendente',
      modalidade: 'fixo',
    },
  })

  const template =
    (await db.contratoTemplate.findFirst({
      where: { workspaceId: ws.id, ativo: true, isDefault: true, tipo: 'venda' },
    })) ||
    (await db.contratoTemplate.findFirst({
      where: { workspaceId: ws.id, ativo: true },
      orderBy: { updatedAt: 'desc' },
    }))
  if (!template) return NextResponse.json({ error: 'no_template' }, { status: 400 })

  const ctx: RenderContext = {
    empresa: ws.empresa,
    cliente,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contrato: contrato as any,
    produto: {
      grao: 'soja',
      quantidade: qtd,
      preco,
      subtotal,
      unidade: 't',
    } as ProductInfo,
  }
  const resolved = resolveContent(template.contentJson, ctx)
  const brandNome = ws.empresa?.nomeFantasia || ws.empresa?.razaoSocial || ws.name

  const staffNome = ws.owner.nome ?? 'Admin Mercograin'
  const staffEmail = ws.owner.email ?? null

  const pdfBuffer = (await renderTemplateToPdfBuffer(resolved, {
    customLogoUrl: ws.empresa?.logoUrl ?? null,
    documentTitle: `Contrato ${contrato.numero}`,
    brandNome,
    assinaturaStaff: {
      nome: staffNome,
      cargo: 'Diretor Comercial',
      email: staffEmail,
      assinadoEm: new Date().toISOString(),
      ip: '177.10.10.10',
      empresaNome: ws.empresa?.razaoSocial ?? brandNome,
      empresaCnpj: ws.empresa?.cnpj ?? null,
    },
  })) as Buffer
  const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

  const provider = await getSignatureProvider(ws.id)
  const sendResp = await provider.send({
    contractId: contrato.id,
    contractNumber: contrato.numero,
    pdfBuffer,
    pdfFileName: `Contrato-${contrato.numero}.pdf`,
    pdfHash,
    signatories: [
      {
        name: 'Gustavo Telles',
        cpfCnpj: '11144477735',
        email: 'aero.gus@hotmail.com',
        phone: '51997904545',
        authMode: 'simple',
      },
    ],
    externalId: contrato.id,
  })
  if (!sendResp.ok || !sendResp.signUrls[0]?.url) {
    return NextResponse.json({ error: 'provider_failed' }, { status: 500 })
  }
  const tokenHashes: Array<string | null> =
    provider.name === 'native' && Array.isArray(sendResp.rawResponse?.tokens)
      ? (sendResp.rawResponse.tokens as Array<{ tokenHash?: string }>).map((t) => t?.tokenHash ?? null)
      : [null]
  await db.assinaturaDigital.create({
    data: {
      workspaceId: ws.id,
      contratoId: contrato.id,
      providerNome: provider.name,
      providerDocId: sendResp.providerDocId,
      authMode: 'simple',
      status: 'pendente',
      enviadoEm: new Date(),
      signatarios: [
        {
          ordem: 0,
          nome: 'Gustavo Telles',
          name: 'Gustavo Telles',
          cpfCnpj: '11144477735',
          email: 'aero.gus@hotmail.com',
          telefone: '51997904545',
          authMode: 'simple',
          signedAt: null,
          tokenHash: tokenHashes[0] ?? null,
          signUrl: sendResp.signUrls[0].url,
        },
      ],
      pdfOriginalHash: pdfHash,
      webhookSecret: crypto.randomBytes(24).toString('hex'),
    },
  })
  await db.contrato.update({
    where: { id: contrato.id },
    data: { statusAssinatura: 'enviada', pdfHash, pdfHashedAt: new Date() },
  })

  const notif = await notifySignatario({
    contratoNumero: contrato.numero,
    brandNome,
    signatario: {
      nome: 'Gustavo Telles',
      email: 'aero.gus@hotmail.com',
      telefone: '51997904545',
      url: sendResp.signUrls[0].url,
    },
  })

  return NextResponse.json({
    ok: true,
    contrato: { id: contrato.id, numero: contrato.numero },
    proposta: { numero: proposta.numero, valor: subtotal },
    signUrl: sendResp.signUrls[0].url,
    logoUsado: ws.empresa?.logoUrl,
    staff: { nome: staffNome, cargo: 'Diretor Comercial' },
    notif,
  })
}
