/**
 * POST /api/portal/propostas/[id]/contra-oferta
 *
 * Cliente no portal aceita com ressalva e propõe alterações.
 *
 * Cria uma NOVA proposta clonada com as alterações sugeridas pelo cliente,
 * vinculada à original via propostaOriginalId. A original muda para
 * 'em_negociacao'. Vendedor recebe notificação (WhatsApp + email).
 *
 * Body:
 *   {
 *     aceitanteNome: string,
 *     comentario: string,          // razão da contra-oferta
 *     novosGraos?: GraoItem[],     // se quer mudar quantidades/preços
 *     novaValidadeEm?: string,     // se quer mais prazo
 *   }
 *
 * Resposta: { novaPropostaId, novaPropostaNumero }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { nextNumber } from '@/lib/numbering/next-number'
import { PROPOSTA_STATUS, podeDecidirPortal } from '@/lib/propostas/status'
import { normalizarGraos } from '@/lib/propostas/grao-item'
import { sendEmailRastreado } from '@/lib/email/send-rastreado'
import { notificarPorWhats } from '@/lib/whatsapp/notificar'

const schema = z.object({
  aceitanteNome: z.string().min(2).max(200),
  comentario: z.string().min(5, 'Explique o que mudou').max(800),
  novosGraos: z
    .array(
      z.object({
        grao: z.string(),
        quantidade: z.number().positive(),
        preco: z.number().positive(),
        subtotal: z.number().positive(),
      })
    )
    .optional(),
  novaValidadeEm: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sess = await requirePortal()
    if (!sess) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const original = await db.proposta.findFirst({
      where: {
        id: params.id,
        clienteId: sess.clienteId,
        workspaceId: sess.workspaceId,
      },
      include: {
        cliente: { select: { nome: true } },
        workspace: { select: { name: true, slug: true } },
        vendedor: {
          select: {
            email: true,
            telefoneWhats: true,
            user: { select: { nome: true, email: true, telefone: true } },
          },
        },
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (!podeDecidirPortal(original.status)) {
      return NextResponse.json(
        { error: `Proposta com status '${original.status}' não aceita contra-oferta` },
        { status: 409 }
      )
    }

    if (original.validadeEm.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Proposta vencida' }, { status: 409 })
    }

    // Define grãos e validade da contra-oferta
    const graosBase = data.novosGraos ?? normalizarGraos(original.graos)
    const graosFinais = graosBase.map((g) => ({
      grao: g.grao,
      quantidade: g.quantidade,
      preco: g.preco,
      subtotal: g.subtotal,
    }))
    const valorTotal = graosFinais.reduce((acc, g) => acc + g.subtotal, 0)

    let novaValidade: Date
    if (data.novaValidadeEm) {
      novaValidade = new Date(data.novaValidadeEm)
      if (isNaN(novaValidade.getTime())) {
        return NextResponse.json({ error: 'novaValidadeEm inválida' }, { status: 400 })
      }
    } else {
      novaValidade = original.validadeEm
    }

    // Snapshot do diff para audit
    const graosOriginais = normalizarGraos(original.graos)
    const mudancas: Record<string, unknown> = {
      aceitanteNome: data.aceitanteNome,
      comentario: data.comentario,
    }
    if (data.novosGraos) {
      mudancas.graos = { de: graosOriginais, para: graosFinais }
    }
    if (data.novaValidadeEm && novaValidade.getTime() !== original.validadeEm.getTime()) {
      mudancas.validadeEm = {
        de: original.validadeEm.toISOString(),
        para: novaValidade.toISOString(),
      }
    }

    const numeroGerado = await nextNumber(sess.workspaceId, 'proposta')
    const carimbo = `[contra-oferta de ${original.numero}] por: ${data.aceitanteNome} · "${data.comentario}"`

    // Cria nova proposta (rascunho, vinculada à original)
    const nova = await db.proposta.create({
      data: {
        numero: numeroGerado,
        clienteId: original.clienteId,
        workspaceId: sess.workspaceId,
        tipo: original.tipo,
        graos: graosFinais,
        valorTotal: String(valorTotal),
        status: PROPOSTA_STATUS.RASCUNHO,
        descricao: original.descricao,
        validadeEm: novaValidade,
        validadeCotacao: novaValidade,
        vendedorId: original.vendedorId,
        gerenteContaId: original.gerenteContaId,
        canalAutorizacao: original.canalAutorizacao ?? 'web',
        origem: original.origem,
        localEntrega: original.localEntrega,
        observacoes: [original.observacoes, carimbo].filter(Boolean).join('\n').trim(),
        propostaOriginalId: original.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contraOfertaMudancas: mudancas as any,
      },
      select: { id: true, numero: true },
    })

    // Move a original para 'em_negociacao'
    await db.proposta.update({
      where: { id: original.id },
      data: { status: PROPOSTA_STATUS.EM_NEGOCIACAO },
    })

    // Audit log
    await db.auditLog
      .create({
        data: {
          userId: sess.accessId,
          workspaceId: sess.workspaceId,
          acao: 'contra_oferta_cliente',
          entidade: 'proposta',
          entidadeId: original.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mudancas: {
            numeroOriginal: original.numero,
            numeroContraOferta: nova.numero,
            comentario: data.comentario,
            mudancas,
          } as any,
        },
      })
      .catch(() => undefined)

    // Notificar vendedor (email + WhatsApp)
    const origin = request.headers.get('origin') ?? request.nextUrl.origin
    void notificarVendedorContraOferta({
      vendedor: original.vendedor,
      gerenteConta: null,
      clienteNome: original.cliente?.nome ?? 'Cliente',
      workspaceNome: original.workspace?.name ?? 'workspace',
      propostaNumeroOriginal: original.numero,
      propostaNumeroNova: nova.numero,
      novaPropostaId: nova.id,
      aceitanteNome: data.aceitanteNome,
      comentario: data.comentario,
      origin,
      workspaceId: sess.workspaceId,
    })

    return NextResponse.json({
      novaPropostaId: nova.id,
      novaPropostaNumero: nova.numero,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Contra-oferta error:', error)
    return NextResponse.json({ error: 'Erro ao registrar contra-oferta' }, { status: 500 })
  }
}

interface VendedorParcial {
  email: string | null
  telefoneWhats: string | null
  user: { nome: string | null; email: string | null; telefone: string | null } | null
}

async function notificarVendedorContraOferta(args: {
  vendedor: VendedorParcial | null
  gerenteConta: VendedorParcial | null
  clienteNome: string
  workspaceNome: string
  propostaNumeroOriginal: string
  propostaNumeroNova: string
  novaPropostaId: string
  aceitanteNome: string
  comentario: string
  origin: string
  workspaceId: string
}): Promise<void> {
  try {
    const linkInterno = `${args.origin}/propostas/${args.novaPropostaId}`
    const destinos = new Map<
      string,
      { nome: string; email: string | null; telefone: string | null }
    >()
    for (const m of [args.vendedor, args.gerenteConta]) {
      if (!m) continue
      const email = m.user?.email ?? m.email
      const telefone = m.telefoneWhats ?? m.user?.telefone ?? null
      const nome = m.user?.nome ?? email?.split('@')[0] ?? 'time'
      const chave = email ?? telefone
      if (!chave || destinos.has(chave)) continue
      destinos.set(chave, { nome, email: email ?? null, telefone })
    }

    for (const { nome, email, telefone } of destinos.values()) {
      if (email) {
        const html = `
          <p>Olá ${nome},</p>
          <p><strong>${args.clienteNome}</strong> propôs uma contra-oferta para a proposta
          <strong>${args.propostaNumeroOriginal}</strong>.</p>
          <p>Foi criada a contra-proposta <strong>${args.propostaNumeroNova}</strong> em rascunho
          para você revisar.</p>
          <div style="padding:12px;border-left:3px solid #0a8a3a;background:#f7faf3;margin:14px 0;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#666;">Comentário do cliente:</p>
            <p style="margin:0;font-size:14px;">"${args.comentario}"</p>
            <p style="margin:8px 0 0 0;font-size:11px;color:#999;">por ${args.aceitanteNome}</p>
          </div>
          <p><a href="${linkInterno}" style="display:inline-block;padding:10px 18px;background:#0a8a3a;color:#fff;text-decoration:none;border-radius:6px;">Revisar contra-oferta</a></p>
        `
        await sendEmailRastreado({
          workspaceId: args.workspaceId,
          categoria: 'contra_oferta_time_email',
          destinatarioNome: nome,
          to: email,
          subject: `Contra-oferta: ${args.clienteNome} sobre ${args.propostaNumeroOriginal}`,
          html,
          meta: {
            propostaOriginal: args.propostaNumeroOriginal,
            propostaNova: args.propostaNumeroNova,
          },
        })
      }
      if (telefone) {
        const texto =
          `🔄 *Contra-oferta de ${args.workspaceNome}*\n\n` +
          `Olá ${nome},\n\n` +
          `*${args.clienteNome}* propôs alterações na proposta *${args.propostaNumeroOriginal}*.\n\n` +
          `📋 Criada nova proposta *${args.propostaNumeroNova}* em rascunho.\n\n` +
          `💬 _"${args.comentario}"_\n` +
          `por: ${args.aceitanteNome}\n\n` +
          `Revisar: ${linkInterno}\n\n` +
          `_Enviado automaticamente pelo sistema_`
        void notificarPorWhats({
          workspaceId: args.workspaceId,
          para: telefone,
          texto,
          categoria: 'proposta_aceita_time',
          meta: {
            propostaNumeroOriginal: args.propostaNumeroOriginal,
            propostaNumeroNova: args.propostaNumeroNova,
            tipo: 'contra_oferta',
          },
        })
      }
    }
  } catch (err) {
    console.warn('[notificarVendedorContraOferta] best-effort falhou:', err)
  }
}
