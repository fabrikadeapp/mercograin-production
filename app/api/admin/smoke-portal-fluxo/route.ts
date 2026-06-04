/**
 * TEMPORÁRIO — smoke end-to-end do fluxo do portal cliente da corretora.
 * Authorization: Bearer ${CRON_SECRET}
 *
 * Passos:
 *  0. Limpa contas/resets/contratos antigos do email aero.gus@hotmail.com (cliente Rei do Gado)
 *  1. /api/assinar/[token]/status-portal → próximoPasso = 'signup'
 *  2. /api/portal/signup-por-token cria conta + cookie
 *  3. /api/portal/me valida sessão
 *  4. /api/portal/perfil GET → mostra obrigatórios faltando
 *  5. /api/portal/perfil PATCH → preenche tudo → completo=true
 *  6. /api/portal/consentimentos PUT (execução + compartilhamento obrigatórios)
 *  7. /api/portal/auth/forgot (apenas valida que retorna 200)
 *  8. /api/assinar/[token] POST → assina contrato
 *  9. /api/portal/contratos-assinados → vê contrato assinado
 *  10. /api/portal/recebiveis → smoke OK (lista mesmo vazia)
 *  11. revoga assinatura (limpeza)
 *
 *  Retorna log estruturado de cada passo.
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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

interface Passo {
  passo: string
  ok: boolean
  detalhe?: unknown
  erro?: string
}

const EMAIL = 'aero.gus@hotmail.com'

async function callWithCookie(
  url: string,
  init: RequestInit & { jar?: Record<string, string> } = {},
): Promise<{
  status: number
  body: unknown
  setCookies: string[]
}> {
  const headers = new Headers(init.headers || {})
  if (init.jar) {
    const cookieHeader = Object.entries(init.jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    if (cookieHeader) headers.set('cookie', cookieHeader)
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const r = await fetch(url, { ...init, headers })
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []
  let body: unknown
  try {
    body = await r.json()
  } catch {
    body = await r.text()
  }
  return { status: r.status, body, setCookies: sc }
}

function jarFromSetCookies(setCookies: string[], current: Record<string, string> = {}): Record<string, string> {
  const out = { ...current }
  for (const c of setCookies) {
    const [pair] = c.split(';')
    const [k, v] = pair.split('=')
    if (k && v != null) out[k.trim()] = v.trim()
  }
  return out
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const base = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
  const passos: Passo[] = []
  let jar: Record<string, string> = {}

  try {
    // 0. Limpeza: deletar ProdutorAccess do email + assinaturas antigas do contrato Rei do Gado
    const cliente = await db.cliente.findFirst({
      where: { nome: { contains: 'rei do gado', mode: 'insensitive' } },
      select: { id: true, workspaceId: true },
    })
    if (!cliente) {
      return NextResponse.json({ error: 'cliente_rei_do_gado_nao_encontrado' }, { status: 404 })
    }

    const accessExistente = await db.produtorAccess.findUnique({
      where: { emailLogin: EMAIL },
    })
    if (accessExistente) {
      await db.produtorPasswordReset.deleteMany({
        where: { produtorAccessId: accessExistente.id },
      })
      await db.dadosBancariosCliente.deleteMany({
        where: { produtorAccessId: accessExistente.id },
      })
      await db.produtorAccess.delete({ where: { id: accessExistente.id } })
    }
    passos.push({ passo: '0-limpeza', ok: true, detalhe: { tinhaAccess: !!accessExistente } })

    // 0.1 Cria contrato + assinatura nativa fresh
    const proposta = await db.proposta.findFirst({
      where: { clienteId: cliente.id },
      orderBy: { criadaEm: 'desc' },
      include: { contratos: { take: 1, orderBy: { criadoEm: 'desc' } } },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'proposta_rei_do_gado_nao_encontrada' }, { status: 404 })
    }
    let contratoId = proposta.contratos?.[0]?.id ?? null
    if (!contratoId) {
      const c = await db.contrato.create({
        data: {
          numero: `CT-${Date.now().toString(36).toUpperCase()}`,
          proposIdFk: proposta.id,
          clienteId: cliente.id,
          workspaceId: cliente.workspaceId,
          dataInicio: new Date(),
          statusAssinatura: 'pendente',
          modalidade: 'fixo',
        },
      })
      contratoId = c.id
    }
    // Apaga qualquer assinaturaDigital antiga
    await db.assinaturaDigital
      .deleteMany({ where: { contratoId } })
      .catch(() => undefined)

    // Resolve template + render PDF
    const template =
      (await db.contratoTemplate.findFirst({
        where: {
          workspaceId: cliente.workspaceId,
          ativo: true,
          isDefault: true,
          tipo: proposta.tipo,
        },
      })) ||
      (await db.contratoTemplate.findFirst({
        where: { workspaceId: cliente.workspaceId, ativo: true },
        orderBy: { updatedAt: 'desc' },
      }))
    if (!template) {
      return NextResponse.json({ error: 'no_template' }, { status: 400 })
    }
    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: cliente.workspaceId },
    })
    const contratoFresh = await db.contrato.findUnique({
      where: { id: contratoId },
      include: { cliente: true, proposta: true },
    })
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
      cliente: contratoFresh!.cliente,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contrato: contratoFresh as any,
      produto,
    }
    const resolved = resolveContent(template.contentJson, ctx)
    const pdfBuffer = (await renderTemplateToPdfBuffer(resolved, {
      customLogoUrl: empresa?.logoUrl ?? null,
      itensGrao: [],
      documentTitle: `Contrato ${contratoFresh!.numero}`,
    })) as Buffer
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    const provider = await getSignatureProvider(cliente.workspaceId)
    const sendResp = await provider.send({
      contractId: contratoFresh!.id,
      contractNumber: contratoFresh!.numero,
      pdfBuffer,
      pdfFileName: `Contrato-${contratoFresh!.numero}.pdf`,
      pdfHash,
      signatories: [
        {
          name: 'Gustavo Smoke',
          cpfCnpj: '00000000000',
          email: EMAIL,
          phone: '51997904545',
          authMode: 'simple',
        },
      ],
      externalId: contratoFresh!.id,
    })
    if (!sendResp.ok || !sendResp.signUrls[0]?.url) {
      passos.push({ passo: '0.1-create-token', ok: false, erro: 'provider_failed' })
      return NextResponse.json({ passos }, { status: 500 })
    }
    const tokenHashes: Array<string | null> =
      provider.name === 'native' && Array.isArray(sendResp.rawResponse?.tokens)
        ? (sendResp.rawResponse.tokens as Array<{ tokenHash?: string }>).map((t) => t?.tokenHash ?? null)
        : [null]

    await db.assinaturaDigital.create({
      data: {
        workspaceId: cliente.workspaceId,
        contratoId: contratoFresh!.id,
        providerNome: provider.name,
        providerDocId: sendResp.providerDocId,
        authMode: 'simple',
        status: 'pendente',
        enviadoEm: new Date(),
        signatarios: [
          {
            ordem: 0,
            nome: 'Gustavo Smoke',
            name: 'Gustavo Smoke',
            cpfCnpj: '00000000000',
            email: EMAIL,
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
      where: { id: contratoFresh!.id },
      data: { statusAssinatura: 'enviada', pdfHash, pdfHashedAt: new Date() },
    })

    const url = sendResp.signUrls[0].url
    const token = url.split('/assinar/')[1]
    passos.push({ passo: '0.1-create-token', ok: true, detalhe: { providerDocId: sendResp.providerDocId, urlPrefix: url.slice(0, 50) } })

    // 1. status-portal — espera signup
    {
      const r = await callWithCookie(`${base}/api/assinar/${token}/status-portal`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      passos.push({
        passo: '1-status-portal',
        ok: r.status === 200 && j?.proximoPasso === 'signup',
        detalhe: { proximoPasso: j?.proximoPasso, workspaceSlug: j?.workspaceSlug },
      })
    }

    // 2. signup
    {
      const r = await callWithCookie(`${base}/api/portal/signup-por-token`, {
        method: 'POST',
        body: JSON.stringify({ token, senha: 'SmokeTeste123' }),
      })
      jar = jarFromSetCookies(r.setCookies, jar)
      passos.push({
        passo: '2-signup',
        ok: r.status === 200,
        detalhe: { status: r.status, body: r.body },
      })
      if (r.status !== 200) {
        return NextResponse.json({ passos }, { status: 500 })
      }
    }

    // 3. me
    {
      const r = await callWithCookie(`${base}/api/portal/me`, { jar })
      passos.push({ passo: '3-me', ok: r.status === 200, detalhe: { status: r.status } })
    }

    // 4. perfil GET
    {
      const r = await callWithCookie(`${base}/api/portal/perfil`, { jar })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      passos.push({
        passo: '4-perfil-get',
        ok: r.status === 200 && Array.isArray(j?.obrigatoriosFaltando),
        detalhe: { faltando: j?.obrigatoriosFaltando?.length, completo: j?.completo },
      })
    }

    // 5. perfil PATCH (preenche tudo)
    {
      const r = await callWithCookie(`${base}/api/portal/perfil`, {
        method: 'PATCH',
        jar,
        body: JSON.stringify({
          nomeCompleto: 'Gustavo Smoke Telles',
          cpfCnpj: '11144477735', // CPF válido para teste
          rg: '12345678',
          nomePai: 'Pai Smoke',
          nomeMae: 'Mae Smoke',
          profissao: 'Empresario',
          nacionalidade: 'Brasileira',
          telefone: '51997904545',
          whatsapp: '51997904545',
          enderecoCep: '90000000',
          enderecoLogradouro: 'Rua de Teste',
          enderecoNumero: '100',
          enderecoBairro: 'Centro',
          enderecoCidade: 'Porto Alegre',
          enderecoUf: 'RS',
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      passos.push({
        passo: '5-perfil-patch',
        ok: r.status === 200 && j?.completo === true,
        detalhe: { completo: j?.completo, faltando: j?.obrigatoriosFaltando },
      })
    }

    // 6. consentimentos PUT
    {
      const r = await callWithCookie(`${base}/api/portal/consentimentos`, {
        method: 'PUT',
        jar,
        body: JSON.stringify({
          execucaoContrato: true,
          comunicacaoWhatsapp: true,
          compartilhamentoBancoCartorio: true,
          marketing: false,
        }),
      })
      passos.push({ passo: '6-consent', ok: r.status === 200, detalhe: { status: r.status } })
    }

    // 7. forgot
    {
      const r = await callWithCookie(`${base}/api/portal/auth/forgot`, {
        method: 'POST',
        body: JSON.stringify({ email: EMAIL }),
      })
      passos.push({ passo: '7-forgot', ok: r.status === 200, detalhe: { status: r.status } })
    }

    // 8. assina o contrato
    {
      const r = await callWithCookie(`${base}/api/assinar/${token}`, {
        method: 'POST',
        body: JSON.stringify({
          nomeCompleto: 'Gustavo Smoke Telles',
          cpfCnpj: '11144477735',
          liEConcordo: true,
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      passos.push({
        passo: '8-assinar',
        ok: r.status === 200 && j?.ok === true && j?.todosAssinaram === true,
        detalhe: { status: r.status, todosAssinaram: j?.todosAssinaram, protocolo: j?.protocolo },
      })
    }

    // 9. contratos assinados (com cookie)
    {
      const r = await callWithCookie(`${base}/api/portal/contratos-assinados`, { jar })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      const assinados = (j?.contratos ?? []).filter((c: { statusAssinatura: string }) => c.statusAssinatura === 'assinado')
      passos.push({
        passo: '9-lista-contratos-assinados',
        ok: r.status === 200 && assinados.length >= 1,
        detalhe: { total: j?.contratos?.length, assinados: assinados.length },
      })
    }

    // 10. recebíveis (com cookie)
    {
      const r = await callWithCookie(`${base}/api/portal/recebiveis`, { jar })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = r.body as any
      passos.push({
        passo: '10-recebiveis',
        ok: r.status === 200 && j?.ok === true,
        detalhe: { total: j?.boletos?.length, resumo: j?.resumo },
      })
    }

    // 11. limpeza final — apaga contrato/access para não poluir prod
    const accessLimpeza = await db.produtorAccess.findUnique({
      where: { emailLogin: EMAIL },
    })
    if (accessLimpeza) {
      await db.produtorPasswordReset.deleteMany({
        where: { produtorAccessId: accessLimpeza.id },
      })
      await db.produtorAccess.delete({ where: { id: accessLimpeza.id } })
    }
    await db.assinaturaDigital
      .deleteMany({ where: { contratoId: contratoFresh!.id } })
      .catch(() => undefined)
    await db.contrato.update({
      where: { id: contratoFresh!.id },
      data: { statusAssinatura: 'pendente', assinadoEm: null, pdfHash: null },
    })
    passos.push({ passo: '11-limpeza', ok: true })

    const sucesso = passos.every((p) => p.ok)
    return NextResponse.json({ sucesso, passos })
  } catch (e: unknown) {
    return NextResponse.json(
      { passos, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
