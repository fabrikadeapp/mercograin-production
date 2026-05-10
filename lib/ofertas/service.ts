/**
 * S10 M2 — Helpers Oferta.
 *
 * Política multi-tenant:
 *   - CRUD opera SOMENTE dentro do workspaceId do scope (estrita).
 *   - marketplace() devolve ofertas `publica=true && status='aberta'` de TODOS
 *     workspaces (cross-tenant READ-ONLY) — view pública agregada.
 *   - aceitar() cria Proposta no workspace que ACEITA (não no que ofertou)
 *     e marca a Oferta com status='aceita' + propostaId.
 */
import { db } from '@/lib/db'

export interface OfertaInput {
  tipo: 'compra' | 'venda'
  cultura: string
  qtdSc: number
  precoSc: number
  precoMoeda?: 'BRL' | 'USD'
  origem?: string | null
  destino?: string | null
  validadeHoras?: number
  publica?: boolean
  observacao?: string | null
}

/** Gera número sequencial-ish (CUID-friendly): OF-YYYYMM-{6chars} */
export function gerarNumeroOferta(): string {
  const now = new Date()
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `OF-${yyyymm}-${rand}`
}

export function calcValidaAte(horas = 72): Date {
  return new Date(Date.now() + horas * 3600_000)
}

export interface OfertaFiltros {
  cultura?: string
  tipo?: 'compra' | 'venda'
  status?: string
  precoMin?: number
  precoMax?: number
}

export function buildWhere(workspaceId: string | null, f: OfertaFiltros) {
  const where: any = {}
  if (workspaceId) where.workspaceId = workspaceId
  if (f.cultura) where.cultura = f.cultura
  if (f.tipo) where.tipo = f.tipo
  if (f.status) where.status = f.status
  if (f.precoMin != null || f.precoMax != null) {
    where.precoSc = {}
    if (f.precoMin != null) where.precoSc.gte = f.precoMin
    if (f.precoMax != null) where.precoSc.lte = f.precoMax
  }
  return where
}

/** Marca como `expirada` qualquer Oferta com validaAte passada e status='aberta'. */
export async function expirarVencidas(workspaceId?: string): Promise<number> {
  const where: any = { status: 'aberta', validaAte: { lt: new Date() } }
  if (workspaceId) where.workspaceId = workspaceId
  const r = await db.oferta.updateMany({ where, data: { status: 'expirada' } })
  return r.count
}
