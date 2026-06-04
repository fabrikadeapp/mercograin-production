/**
 * Schema canônico do item de grão dentro de Proposta.graos / Contrato.proposta.graos.
 *
 * Inventário: hoje há 2 variantes circulando no banco e em código:
 *   variant A: { grao, quantidade, preco, subtotal }  ← criado por nosso form
 *   variant B: { commodity, quantidadeSc }            ← criado por Laura/IA legado
 *
 * Esta lib normaliza ambas em GraoItemCanonico e oferece helpers seguros.
 *
 * Unidades canônicas:
 *   quantidade → toneladas
 *   preco       → R$/tonelada
 *   subtotal    → R$
 */

import { z } from 'zod'
import { KG_POR_SC, type Grao } from '@/lib/cotacoes/unidades'

const GRAOS_VALIDOS: Grao[] = [
  'soja',
  'milho',
  'trigo',
  'sorgo',
  'aveia',
  'arroz',
  'cafe',
  'algodao',
]

/** Forma canônica usada em todo código novo. */
export interface GraoItemCanonico {
  grao: Grao
  /** Toneladas. */
  quantidade: number
  /** R$/t. */
  preco: number
  /** R$. quantidade × preco arredondado a 2 casas. */
  subtotal: number
}

/** Schema Zod para validar input vindo do form/API. */
export const graoItemSchema = z.object({
  grao: z.string().min(1, 'Grão obrigatório'),
  quantidade: z.number().positive('Quantidade > 0'),
  preco: z.number().positive('Preço > 0'),
  subtotal: z.number().positive('Subtotal > 0'),
})

/**
 * Normaliza um item de grão de qualquer variante para o formato canônico.
 *
 * Trata:
 *   - { grao, quantidade, preco, subtotal }      → identity
 *   - { commodity, quantidadeSc }                → converte sc para t, preco fica 0
 *   - { grao, quantidadeSc }                     → idem
 *   - faltando subtotal                          → calcula quantidade × preco
 *
 * Retorna null se grão for inválido (não está na lista canônica).
 */
export function normalizarGraoItem(raw: unknown): GraoItemCanonico | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  // Identifica nome do grão (variant grao OU commodity, normaliza pra lowercase)
  const nomeBruto = String(r.grao ?? r.commodity ?? '').toLowerCase().trim()
  if (!nomeBruto) return null
  const grao = GRAOS_VALIDOS.find((g) => g === nomeBruto)
  if (!grao) return null

  // Quantidade: aceita .quantidade (já em t) OU .quantidadeSc (precisa converter)
  let quantidade = 0
  if (typeof r.quantidade === 'number' && r.quantidade > 0) {
    quantidade = r.quantidade
  } else if (typeof r.quantidadeSc === 'number' && r.quantidadeSc > 0) {
    const kgPorSc = KG_POR_SC[grao] ?? 60
    quantidade = (r.quantidadeSc * kgPorSc) / 1000
  } else if (typeof r.quantidade === 'string') {
    const n = Number(r.quantidade)
    if (Number.isFinite(n) && n > 0) quantidade = n
  }
  if (quantidade <= 0) return null

  // Preço: aceita .preco em R$/t. Variant legada pode não ter.
  const preco = typeof r.preco === 'number' && r.preco > 0 ? r.preco : 0

  // Subtotal: prefere o que veio; senão calcula.
  let subtotal = 0
  if (typeof r.subtotal === 'number' && r.subtotal > 0) {
    subtotal = r.subtotal
  } else {
    subtotal = Math.round(quantidade * preco * 100) / 100
  }

  return { grao, quantidade, preco, subtotal }
}

/**
 * Recebe Proposta.graos (JSON) e devolve array normalizado e filtrado.
 * Garantia: sempre retorna array (vazio se inválido).
 */
export function normalizarGraos(graos: unknown): GraoItemCanonico[] {
  if (!Array.isArray(graos)) return []
  const out: GraoItemCanonico[] = []
  for (const g of graos) {
    const norm = normalizarGraoItem(g)
    if (norm) out.push(norm)
  }
  return out
}

/** Soma total em R$ dos subtotais válidos. */
export function somaValorTotal(graos: unknown): number {
  return normalizarGraos(graos).reduce((acc, g) => acc + g.subtotal, 0)
}

/** Soma total em toneladas. */
export function somaQuantidadeTon(graos: unknown): number {
  return normalizarGraos(graos).reduce((acc, g) => acc + g.quantidade, 0)
}

/** Primeiro grão (mais comum em propostas de 1 item). null se array vazio. */
export function primeiroGrao(graos: unknown): GraoItemCanonico | null {
  return normalizarGraos(graos)[0] ?? null
}
