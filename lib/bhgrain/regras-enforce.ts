/**
 * BH Grain — Motor de enforcement de CommercialRule no envio de Proposta.
 *
 * Avalia regras ativas e retorna decisão:
 *   - 'permitido'  → pode enviar
 *   - 'bloqueado'  → ação 'bloquear' disparou (preço vencido, margem mínima)
 *   - 'aprovacao'  → ação 'aprovar' disparou (valor/margem) → exige Aprovacao
 *   - 'alerta'     → só registra alerta, não bloqueia
 */

import { db } from '@/lib/db'

export type EnforceResult =
  | { decisao: 'permitido' }
  | { decisao: 'bloqueado'; motivos: string[]; regras: string[] }
  | { decisao: 'aprovacao'; motivos: string[]; regras: string[] }

export async function enforceRegrasEnvio(propostaId: string, workspaceId: string): Promise<EnforceResult> {
  const [p, regras] = await Promise.all([
    db.proposta.findFirst({
      where: { id: propostaId, workspaceId },
      select: {
        id: true,
        valorTotal: true,
        margemPercent: true,
        validadeCotacao: true,
        graos: true,
      },
    }),
    db.commercialRule.findMany({ where: { workspaceId, active: true } }),
  ])
  if (!p) return { decisao: 'bloqueado', motivos: ['Proposta não encontrada'], regras: [] }

  const motivosBloqueio: string[] = []
  const motivosAprovacao: string[] = []
  const regrasBloqueio: string[] = []
  const regrasAprovacao: string[] = []

  const valorTotal = Number(p.valorTotal)
  const margem = p.margemPercent != null ? Number(p.margemPercent) : null
  const graoCommodity = ((p.graos as { commodity?: string } | null)?.commodity ?? '').toLowerCase()
  const agora = new Date()

  for (const r of regras) {
    // Filtra por commodity se a regra especifica
    if (r.commodity && r.commodity.toLowerCase() !== graoCommodity) continue

    const threshold = r.threshold != null ? Number(r.threshold) : null

    if (r.type === 'bloqueio_preco_vencido' && r.action === 'bloquear') {
      // threshold = minutos máximos de idade da cotação (null = qualquer cotação vencida bloqueia)
      if (p.validadeCotacao && p.validadeCotacao < agora) {
        motivosBloqueio.push(`Cotação vencida — regra "${r.name}"`)
        regrasBloqueio.push(r.id)
      }
    }

    if (r.type === 'margem_minima' && threshold != null && margem != null && margem < threshold) {
      if (r.action === 'bloquear') {
        motivosBloqueio.push(`Margem ${margem.toFixed(2)}% < mínima ${threshold}% — regra "${r.name}"`)
        regrasBloqueio.push(r.id)
      } else if (r.action === 'aprovar') {
        motivosAprovacao.push(`Margem ${margem.toFixed(2)}% < ${threshold}% exige aprovação — "${r.name}"`)
        regrasAprovacao.push(r.id)
      }
    }

    if (r.type === 'aprovacao_valor' && threshold != null && valorTotal >= threshold && r.action === 'aprovar') {
      motivosAprovacao.push(`Valor R$ ${valorTotal.toLocaleString('pt-BR')} ≥ R$ ${threshold.toLocaleString('pt-BR')} exige aprovação — "${r.name}"`)
      regrasAprovacao.push(r.id)
    }

    if (r.type === 'aprovacao_margem' && threshold != null && margem != null && margem < threshold && r.action === 'aprovar') {
      motivosAprovacao.push(`Margem ${margem.toFixed(2)}% < ${threshold}% exige aprovação — "${r.name}"`)
      regrasAprovacao.push(r.id)
    }
  }

  if (motivosBloqueio.length > 0) {
    return { decisao: 'bloqueado', motivos: motivosBloqueio, regras: regrasBloqueio }
  }
  if (motivosAprovacao.length > 0) {
    return { decisao: 'aprovacao', motivos: motivosAprovacao, regras: regrasAprovacao }
  }
  return { decisao: 'permitido' }
}
