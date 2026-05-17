import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const graoSchema = z.object({
  grao: z.string().min(1),
  quantidade: z.number().positive(),
  preco: z.number().positive(),
  subtotal: z.number().positive(),
})

const schema = z.object({
  clienteId: z.string().min(1),
  tipo: z.enum(['venda', 'compra']),
  graos: z.array(graoSchema).min(1),
  valor: z.number().positive(),
  validadeEm: z.string().min(1),
  descricao: z.string().optional(),
  canalAutorizacao: z.enum(['whatsapp', 'telefone', 'ia_autonomo']),
  /** Telefone/handle de quem solicitou (para áudio-trail). */
  origemContato: z.string().optional(),
})

/**
 * POST /api/laura/propostas
 *
 * Endpoint usado por:
 *  - Webhook do WhatsApp quando Laura monta uma proposta a partir da conversa
 *  - Agente de telefonia quando um trader autoriza verbalmente
 *  - Agente IA autônomo agendando ofertas a partir de regras
 *
 * O resultado é uma Proposta com `status='aguardando_autorizacao'` que precisa
 * passar pelo painel `/aprovacoes/propostas`. Quem aprovar fica como `vendedor`
 * da venda.
 *
 * Auth: usa o usuário autenticado (o agente IA precisa ter sessão técnica).
 * Para chamada server-to-server use header X-Workspace-Id + API key futuramente.
 */
export async function POST(req: NextRequest) {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Cliente precisa pertencer ao workspace
  const cliente = await db.cliente.findFirst({
    where: { id: d.clienteId, ...scope.whereOwn() },
    select: { id: true, responsavelId: true },
  })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente_invalido' }, { status: 404 })
  }

  // Geração de número simples baseada em sequência por workspace.
  // Em produção, considerar contador atômico — aqui basta um sufixo determinístico.
  const count = await db.proposta.count({
    where: { workspaceId: scope.workspaceId },
  })
  const numero = `LAURA-${(count + 1).toString().padStart(5, '0')}`

  const proposta = await db.proposta.create({
    data: {
      numero,
      clienteId: d.clienteId,
      workspaceId: scope.workspaceId,
      tipo: d.tipo,
      graos: d.graos,
      valorTotal: String(d.valor),
      status: 'aguardando_autorizacao',
      descricao: d.descricao,
      observacoes: d.origemContato ? `Origem: ${d.origemContato}` : undefined,
      validadeEm: new Date(d.validadeEm),
      // Gerente da conta = responsável atual do cliente (pode ser null)
      gerenteContaId: cliente.responsavelId ?? null,
      // vendedorId fica null até alguém autorizar
      vendedorId: null,
      canalAutorizacao: d.canalAutorizacao,
    },
    include: { cliente: { select: { id: true, nome: true } } },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'laura_proposta_criada',
    entidade: 'proposta',
    entidadeId: proposta.id,
    mudancas: {
      canal: d.canalAutorizacao,
      origemContato: d.origemContato ?? null,
      gerenteContaId: cliente.responsavelId ?? null,
      valor: Number(proposta.valorTotal),
    },
  }).catch(() => null)

  return NextResponse.json({ ok: true, proposta }, { status: 201 })
}
