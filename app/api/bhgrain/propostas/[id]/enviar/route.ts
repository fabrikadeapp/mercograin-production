/**
 * POST /api/bhgrain/propostas/[id]/enviar
 *
 * Aplica enforcement de CommercialRule antes de mudar status para 'enviada'.
 *  - bloqueado → 409 Conflict com motivos
 *  - aprovacao → 202 Accepted + cria Aprovacao + status 'pendente_aprovacao'
 *  - permitido → status 'enviada' + enviadaEm
 *
 * Permissão: send_proposal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { enforceRegrasEnvio } from '@/lib/bhgrain/regras-enforce'
import { abrirAprovacao } from '@/lib/bhgrain/proposta-approval'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { propostaEnviadaClienteTemplate } from '@/lib/email/templates/proposta-enviada-cliente'
import { gerarTokenProposta } from '@/lib/propostas/share-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireBhGrainScope()
    scope.require('send_proposal')
    const { id } = await params

    // Valida proposta pertence ao workspace
    const p = await db.proposta.findFirst({
      where: { id, workspaceId: scope.workspaceId },
      select: {
        id: true,
        status: true,
        numero: true,
        valorTotal: true,
        validadeEm: true,
        graos: true,
        cliente: { select: { id: true, nome: true, email: true } },
        workspace: { select: { name: true, slug: true } },
      },
    })
    if (!p) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

    // Enforcement
    const result = await enforceRegrasEnvio(id, scope.workspaceId)

    if (result.decisao === 'bloqueado') {
      await db.auditLog.create({
        data: {
          userId: scope.userId,
          acao: 'Envio bloqueado por regra comercial',
          entidade: 'Proposta',
          entidadeId: id,
          workspaceId: scope.workspaceId,
          mudancas: { motivos: result.motivos, regras: result.regras },
        },
      })
      return NextResponse.json(
        { decisao: 'bloqueado', motivos: result.motivos, regras: result.regras },
        { status: 409 }
      )
    }

    if (result.decisao === 'aprovacao') {
      const ap = await abrirAprovacao({
        propostaId: id,
        workspaceId: scope.workspaceId,
        solicitanteId: scope.userId,
        motivos: result.motivos,
        regrasAplicadasIds: result.regras,
        workflow: { etapas: [{ ordem: 1, role: 'gestor', nome: 'Aprovação por regra' }], slaHoras: 24 },
      })
      // Marca status como pendente_aprovacao
      await db.proposta.update({
        where: { id },
        data: { status: 'pendente_aprovacao' },
      })
      return NextResponse.json(
        { decisao: 'aprovacao', aprovacaoId: ap.aprovacaoId, motivos: result.motivos },
        { status: 202 }
      )
    }

    // Permitido — envia
    await db.proposta.update({
      where: { id },
      data: { status: 'enviada', enviadaEm: new Date() },
    })
    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'Proposta enviada',
        entidade: 'Proposta',
        entidadeId: id,
        workspaceId: scope.workspaceId,
      },
    })

    // Notifica cliente por email (best-effort, não bloqueia resposta)
    void notificarClienteEnvio(p, request.headers.get('origin') ?? request.nextUrl.origin)

    return NextResponse.json({ decisao: 'permitido', enviada: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg.includes('autoriz') ? 401 : msg.includes('Acesso') || msg.includes('Permissão') ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

interface PropForEnvio {
  id: string
  numero: string
  valorTotal: { toString(): string } | number
  validadeEm: Date
  graos: unknown
  cliente: { id: string; nome: string; email: string | null } | null
  workspace: { name: string; slug: string | null } | null
}

async function notificarClienteEnvio(p: PropForEnvio, origin: string): Promise<void> {
  try {
    const email = p.cliente?.email
    if (!email || !p.cliente || !p.workspace?.slug) return

    const valor = Number(p.valorTotal).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const validade = p.validadeEm.toLocaleDateString('pt-BR')

    const graos = Array.isArray(p.graos) ? (p.graos as Array<Record<string, unknown>>) : []
    const resumo = graos
      .slice(0, 3)
      .map((g) => {
        const grao = String(g.grao ?? '')
        const qtd = Number(g.quantidade ?? 0)
        const preco = Number(g.preco ?? 0)
        return `${qtd.toFixed(2)}t ${grao} @ R$${preco.toFixed(2)}/t`
      })
      .join(' · ')

    const portalUrl = `${origin}/portal/${p.workspace.slug}/propostas/${p.id}`

    // Link público do PDF (token TTL = validade)
    let pdfPublicoUrl: string | null = null
    try {
      const { token } = gerarTokenProposta(p.id, { expiraEm: p.validadeEm })
      pdfPublicoUrl = `${origin}/api/propostas/share/${token}`
    } catch {
      /* ignore */
    }

    const tmpl = propostaEnviadaClienteTemplate({
      clienteNome: p.cliente.nome,
      propostaNumero: p.numero,
      valorFormatado: valor,
      validadeFormatada: validade,
      resumoItens: resumo || undefined,
      portalUrl,
      workspaceNome: p.workspace.name,
      pdfPublicoUrl,
    })

    await sendEmail({
      to: email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      tags: [
        { name: 'kind', value: 'proposta_enviada_cliente' },
        { name: 'proposta_numero', value: p.numero },
      ],
    })
  } catch (err) {
    console.warn('[notificarClienteEnvio] best-effort falhou:', err)
  }
}
