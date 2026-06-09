/**
 * POST /api/mesa/pedido-manual — registro manual de pedido (telefone/presencial).
 *
 * O operador digita um pedido recebido fora dos canais automáticos. O sistema
 * trata igual aos automáticos: dispara a varredura correta e gera propostas-
 * rascunho na fila de ação.
 *   - operacao 'venda'  → varre COMPRADORES (proposta de venda, CEPEA + margem)
 *   - operacao 'compra' → varre VENDEDORES  (proposta de compra, CEPEA − margem)
 * Feature 'match'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  operacao: z.enum(['compra', 'venda']),
  grao: z.string().min(1),
  quantidade: z.number().positive(),
  unidade: z.enum(['sc', 't']).default('sc'),
  clienteId: z.string().optional(),
  origem: z.enum(['telefone', 'presencial', 'manual']).default('manual'),
})

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid' }, { status: 400 })
  }
  const d = parsed.data

  const base = {
    workspaceId: scope.workspaceId,
    grao: d.grao,
    quantidade: d.quantidade,
    unidade: d.unidade,
    origemClienteId: d.clienteId ?? null,
  }

  let gerados
  if (d.operacao === 'compra') {
    const { varrerVendedoresEGerarRascunhos } = await import('@/lib/bhgrain/varredura-vendedores')
    gerados = await varrerVendedoresEGerarRascunhos(base)
  } else {
    const { varrerCompradoresEGerarRascunhos } = await import('@/lib/bhgrain/varredura-compradores')
    gerados = await varrerCompradoresEGerarRascunhos(base)
  }

  await logAudit({
    userId: scope.userId, workspaceId: scope.workspaceId,
    acao: 'pedido_manual_registrado', entidade: 'mesa', entidadeId: scope.workspaceId,
    mudancas: { operacao: d.operacao, grao: d.grao, quantidade: d.quantidade, origem: d.origem, rascunhos: gerados.length },
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    operacao: d.operacao,
    rascunhosGerados: gerados.length,
    detalhe: gerados,
    aviso: gerados.length === 0
      ? `Nenhum ${d.operacao === 'compra' ? 'vendedor' : 'comprador'} compatível encontrado. Cadastre clientes ${d.operacao === 'compra' ? 'vendedores' : 'compradores'} de ${d.grao} ou verifique a cotação do dia.`
      : null,
  })
}
