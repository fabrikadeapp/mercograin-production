/**
 * TEMPORÁRIO — converte a Solicitação B em proposta + cria contrato +
 * envia para assinatura (não simula assinar — você vai assinar pelo email).
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

  // Pega solicitação B pendente da Fazenda
  const sol = await db.solicitacaoCotacao.findFirst({
    where: { status: 'pendente', observacao: { contains: 'B', mode: 'insensitive' } },
    include: {
      cliente: { include: { workspace: { include: { empresa: true } } } },
    },
  })
  if (!sol) return NextResponse.json({ error: 'solicitacaoB_nao_encontrada' }, { status: 404 })

  const ws = sol.cliente.workspace
  const empresa = ws.empresa
  const brandNome = empresa?.nomeFantasia || empresa?.razaoSocial || ws.name

  // 1. Converte em Proposta
  const numero = await nextNumber(ws.id, 'proposta')
  const qtd = Number(sol.quantidade)
  const preco = 1480 // R$/t (preço novo, ligeiramente diferente)
  const subtotal = qtd * preco
  const proposta = await db.proposta.create({
    data: {
      numero,
      clienteId: sol.clienteId,
      workspaceId: ws.id,
      tipo: sol.tipo,
      graos: [{ grao: sol.grao, quantidade: qtd, unidade: sol.unidade, preco, subtotal }],
      valorTotal: String(subtotal),
      status: 'aceita',
      descricao: 'Solicitação B aprovada — preço fechado R$ 1.480/t',
      validadeEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      canalAutorizacao: 'web',
      origem: 'portal_solicitacao',
      localEntrega: sol.localEntrega ?? undefined,
      validadeCotacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  await db.solicitacaoCotacao.update({
    where: { id: sol.id },
    data: { status: 'convertida', propostaId: proposta.id, respondidoEm: new Date() },
  })

  // 2. Contrato
  const numeroCT = await nextNumber(ws.id, 'contrato')
  const contrato = await db.contrato.create({
    data: {
      numero: numeroCT,
      proposIdFk: proposta.id,
      clienteId: sol.clienteId,
      workspaceId: ws.id,
      dataInicio: new Date(),
      statusAssinatura: 'pendente',
      modalidade: 'fixo',
    },
  })

  // 3. PDF + envio
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
    empresa,
    cliente: sol.cliente,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contrato: contrato as any,
    produto: {
      grao: sol.grao,
      quantidade: qtd,
      preco,
      subtotal,
      unidade: sol.unidade,
    } as ProductInfo,
  }
  const resolved = resolveContent(template.contentJson, ctx)
  const pdfBuffer = (await renderTemplateToPdfBuffer(resolved, {
    customLogoUrl: empresa?.logoUrl ?? null,
    documentTitle: `Contrato ${contrato.numero}`,
    brandNome,
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
    proposta: { id: proposta.id, numero: proposta.numero, valor: subtotal },
    contrato: { id: contrato.id, numero: contrato.numero },
    signUrl: sendResp.signUrls[0].url,
    notif,
  })
}
