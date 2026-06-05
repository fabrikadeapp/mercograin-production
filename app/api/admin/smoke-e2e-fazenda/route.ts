/**
 * TEMPORÁRIO — smoke E2E completo do fluxo do produtor.
 *
 * 1. Garante cliente "Fazenda Rei do Gado" no workspace Mercograin.
 * 2. Cria/reseta ProdutorAccess(aero.gus@hotmail.com, senha Fazenda2026).
 * 3. Preenche perfil completo + consentimentos.
 * 4. Cria duas SolicitacaoCotacao (800 t soja) — A e B.
 * 5. Solicitação A: converte em proposta, aprova, gera contrato, envia para assinatura,
 *    simula assinatura, confere statusAssinatura=assinado.
 * 6. Solicitação B: deixa pendente.
 * 7. Calcula snapshots para fluxo-caixa, propostas, contratos, leads.
 */
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/portal-produtor/auth'
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
export const maxDuration = 180

const EMAIL = 'aero.gus@hotmail.com'
const SENHA = 'Fazenda2026'
const WORKSPACE_SLUG = 'mercograin'
const PRECO_SOJA = 145.0 // R$/saca aproximado
const QUANTIDADE_T = 800

interface Passo {
  passo: string
  ok: boolean
  detalhe?: unknown
  erro?: string
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const passos: Passo[] = []
  const credenciais = { email: EMAIL, senha: SENHA, portalUrl: '', loginUrl: '' }

  try {
    // 1. Workspace + Cliente "Fazenda Rei do Gado"
    const ws = await db.workspace.findUnique({
      where: { slug: WORKSPACE_SLUG },
      select: { id: true, name: true, slug: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
    })
    if (!ws) {
      return NextResponse.json({ error: 'workspace_mercograin_nao_existe' }, { status: 404 })
    }
    const base = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
    credenciais.portalUrl = `${base}/portal`
    credenciais.loginUrl = `${base}/portal`

    let cliente = await db.cliente.findFirst({
      where: { workspaceId: ws.id, nome: { contains: 'Rei do Gado', mode: 'insensitive' } },
    })
    if (!cliente) {
      cliente = await db.cliente.create({
        data: {
          workspaceId: ws.id,
          nome: 'Fazenda Rei do Gado',
          email: EMAIL,
          tipo: 'vendedor',
          statusCadastral: 'aprovado',
        },
      })
    } else if (!cliente.email) {
      cliente = await db.cliente.update({
        where: { id: cliente.id },
        data: { email: EMAIL },
      })
    }
    passos.push({ passo: '1-cliente', ok: true, detalhe: { id: cliente.id, nome: cliente.nome } })

    // 2. ProdutorAccess (reseta se existir)
    const existing = await db.produtorAccess.findFirst({
      where: { workspaceId: ws.id, emailLogin: EMAIL },
    })
    if (existing) {
      await db.produtorPasswordReset.deleteMany({ where: { produtorAccessId: existing.id } })
      await db.lead.deleteMany({ where: { produtorAccessId: existing.id } })
      await db.solicitacaoCotacao.deleteMany({ where: { clienteId: cliente.id } })
      await db.produtorAccess.delete({ where: { id: existing.id } })
    }
    const senhaHash = await hashPassword(SENHA)
    const access = await db.produtorAccess.create({
      data: {
        workspaceId: ws.id,
        clienteId: cliente.id,
        emailLogin: EMAIL,
        passwordHash: senhaHash,
        acessoCriadoEm: new Date(),
        ultimoLogin: new Date(),
        nomeCompleto: 'Gustavo Telles',
        cpfCnpj: '11144477735',
        rg: '12345678',
        nomePai: 'José Telles',
        nomeMae: 'Maria Telles',
        profissao: 'Produtor rural',
        nacionalidade: 'Brasileira',
        cargoEmpresa: 'Proprietário',
        telefone: '51997904545',
        whatsapp: '51997904545',
        enderecoCep: '90000000',
        enderecoLogradouro: 'Estrada Geral Rei do Gado',
        enderecoNumero: 'KM 12',
        enderecoBairro: 'Zona Rural',
        enderecoCidade: 'Porto Alegre',
        enderecoUf: 'RS',
        perfilCompletoEm: new Date(),
        // Consentimentos LGPD por finalidade
        consentimentos: [
          { finalidade: 'execucaoContrato', granted: true, ip: 'smoke', ua: 'smoke', timestamp: new Date().toISOString() },
          { finalidade: 'comunicacaoWhatsapp', granted: true, ip: 'smoke', ua: 'smoke', timestamp: new Date().toISOString() },
          { finalidade: 'compartilhamentoBancoCartorio', granted: true, ip: 'smoke', ua: 'smoke', timestamp: new Date().toISOString() },
          { finalidade: 'marketing', granted: false, ip: 'smoke', ua: 'smoke', timestamp: new Date().toISOString() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      },
    })
    passos.push({ passo: '2-access', ok: true, detalhe: { id: access.id } })

    // 2.1 Lead deve ser criado automaticamente — mas vamos forçar/upsert
    await db.lead.upsert({
      where: { produtorAccessId: access.id },
      create: {
        origemWorkspaceId: ws.id,
        produtorAccessId: access.id,
        nomeCompleto: access.nomeCompleto ?? undefined,
        email: EMAIL,
        telefone: access.telefone ?? undefined,
        whatsapp: access.whatsapp ?? undefined,
        cpfCnpj: access.cpfCnpj ?? undefined,
        cargoEmpresa: access.cargoEmpresa ?? undefined,
        cidade: access.enderecoCidade ?? undefined,
        uf: access.enderecoUf ?? undefined,
        status: 'novo',
        fonte: 'smoke_e2e',
      },
      update: {},
    })
    passos.push({ passo: '2.1-lead', ok: true })

    // 3. Cria duas SolicitacaoCotacao
    const solA = await db.solicitacaoCotacao.create({
      data: {
        workspaceId: ws.id,
        clienteId: cliente.id,
        produtorAccessId: access.id,
        tipo: 'venda',
        grao: 'soja',
        quantidade: QUANTIDADE_T,
        unidade: 't',
        precoAlvo: 1450, // R$ por tonelada
        prazoEntregaDias: 60,
        localEntrega: 'Porto de Rio Grande',
        observacao: 'Solicitação A — para aprovar/converter automaticamente',
        status: 'pendente',
      },
    })
    const solB = await db.solicitacaoCotacao.create({
      data: {
        workspaceId: ws.id,
        clienteId: cliente.id,
        produtorAccessId: access.id,
        tipo: 'venda',
        grao: 'soja',
        quantidade: QUANTIDADE_T,
        unidade: 't',
        precoAlvo: 1450,
        prazoEntregaDias: 60,
        localEntrega: 'Porto de Rio Grande',
        observacao: 'Solicitação B — fica PENDENTE para você aprovar pelo painel',
        status: 'pendente',
      },
    })
    passos.push({ passo: '3-solicitacoes', ok: true, detalhe: { solA: solA.id, solB: solB.id } })

    // 4. Converte solA → Proposta (preço fechado pela "mesa")
    const numero = await nextNumber(ws.id, 'proposta')
    const subtotal = QUANTIDADE_T * PRECO_SOJA * (1000 / 60) // converte t→sc e usa preco/sc — mas vamos manter unidade t
    const subtotalT = QUANTIDADE_T * 1450 // R$ por tonelada × t
    const proposta = await db.proposta.create({
      data: {
        numero,
        clienteId: cliente.id,
        workspaceId: ws.id,
        tipo: 'venda',
        graos: [
          { grao: 'soja', quantidade: QUANTIDADE_T, unidade: 't', preco: 1450, subtotal: subtotalT },
        ],
        valorTotal: String(subtotalT),
        status: 'aceita',
        descricao: 'Proposta gerada pela solicitação A — smoke E2E (aprovada automaticamente)',
        validadeEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        canalAutorizacao: 'web',
        origem: 'portal_solicitacao',
        localEntrega: 'Porto de Rio Grande',
        validadeCotacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    await db.solicitacaoCotacao.update({
      where: { id: solA.id },
      data: { status: 'convertida', propostaId: proposta.id, respondidoEm: new Date() },
    })
    passos.push({
      passo: '4-converter-A',
      ok: true,
      detalhe: { propostaId: proposta.id, numero: proposta.numero, valor: subtotalT },
    })

    // 5. Cria Contrato a partir da proposta
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
    passos.push({ passo: '5-contrato', ok: true, detalhe: { id: contrato.id, numero: contrato.numero } })

    // 6. Render PDF + envia assinatura via provider native
    const empresa = await db.dadosEmpresa.findUnique({ where: { workspaceId: ws.id } })
    const template =
      (await db.contratoTemplate.findFirst({
        where: { workspaceId: ws.id, ativo: true, isDefault: true, tipo: 'venda' },
      })) ||
      (await db.contratoTemplate.findFirst({
        where: { workspaceId: ws.id, ativo: true },
        orderBy: { updatedAt: 'desc' },
      }))
    if (!template) {
      return NextResponse.json({ passos, erro: 'no_template' }, { status: 400 })
    }
    const ctx: RenderContext = {
      empresa,
      cliente,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contrato: contrato as any,
      produto: {
        grao: 'soja',
        quantidade: QUANTIDADE_T,
        preco: 1450,
        subtotal: subtotalT,
        unidade: 't',
      } as ProductInfo,
    }
    const resolved = resolveContent(template.contentJson, ctx)
    const brandNome = empresa?.nomeFantasia || empresa?.razaoSocial || ws.name
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
          email: EMAIL,
          phone: '51997904545',
          authMode: 'simple',
        },
      ],
      externalId: contrato.id,
    })
    if (!sendResp.ok) {
      return NextResponse.json({ passos, erro: 'provider_failed' }, { status: 500 })
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
            email: EMAIL,
            telefone: '51997904545',
            authMode: 'simple',
            signedAt: null,
            tokenHash: tokenHashes[0] ?? null,
            signUrl: sendResp.signUrls[0]?.url ?? null,
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
    passos.push({
      passo: '6-envio-assinatura',
      ok: !!sendResp.signUrls[0]?.url,
      detalhe: { url: sendResp.signUrls[0]?.url },
    })

    // 7. Notifica signatário (email real)
    const notif = await notifySignatario({
      contratoNumero: contrato.numero,
      brandNome,
      signatario: {
        nome: 'Gustavo Telles',
        email: EMAIL,
        telefone: '51997904545',
        url: sendResp.signUrls[0]?.url ?? '',
      },
    })
    passos.push({ passo: '7-notify', ok: notif.emailEnviado, detalhe: notif })

    // 8. Simula assinatura programática (POST /api/assinar/[token])
    const url = sendResp.signUrls[0]?.url ?? ''
    const token = url.split('/assinar/')[1] ?? ''
    const baseHost = url.split('/assinar/')[0] || base
    const r = await fetch(`${baseHost}/api/assinar/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeCompleto: 'Gustavo Telles',
        cpfCnpj: '11144477735',
        liEConcordo: true,
      }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; todosAssinaram?: boolean; protocolo?: string }
    passos.push({
      passo: '8-assinar-programatico',
      ok: r.status === 200 && j.ok === true && j.todosAssinaram === true,
      detalhe: { status: r.status, todosAssinaram: j.todosAssinaram, protocolo: j.protocolo },
    })

    // 9. Snapshots dos dashboards (sem auth — só leituras simples no DB)
    const dashboards = {
      solicitacoes: await db.solicitacaoCotacao.groupBy({
        by: ['status'],
        where: { workspaceId: ws.id },
        _count: { _all: true },
      }),
      propostasContratoFazenda: await db.proposta.count({
        where: { clienteId: cliente.id },
      }),
      contratosFazenda: await db.contrato.count({
        where: { clienteId: cliente.id },
      }),
      contratosAssinados: await db.contrato.count({
        where: { clienteId: cliente.id, statusAssinatura: 'assinado' },
      }),
      leads: await db.lead.count({ where: { produtorAccessId: access.id } }),
      boletosFazenda: await db.boleto.count({ where: { clienteId: cliente.id } }),
    }
    passos.push({ passo: '9-dashboards', ok: true, detalhe: dashboards })

    // 10. Resumo
    return NextResponse.json({
      sucesso: passos.every((p) => p.ok),
      credenciais,
      links: {
        portal_login: `${base}/portal`,
        portal_solicitar: `${base}/portal/${ws.slug}/solicitar-cotacao`,
        solicitacoes_mesa: `${base}/solicitacoes`,
        propostas_mesa: `${base}/propostas`,
        contrato_assinado: `${base}/contratos`,
        leads_admin: `${base}/admin/leads`,
      },
      ids: {
        clienteId: cliente.id,
        accessId: access.id,
        solicitacaoA: solA.id,
        solicitacaoB_pendente: solB.id,
        propostaA: proposta.id,
        contratoA: contrato.id,
        providerDocId: sendResp.providerDocId,
      },
      dashboards,
      passos,
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { passos, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
