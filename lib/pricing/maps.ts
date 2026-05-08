/**
 * Maps de plano por slug — substitui as constantes hardcoded `PLANS` /
 * `PLAN_LABELS` que existiam em `lib/stripe/server.ts`.
 *
 * Uso:
 *   const maps = await loadPlanMaps()
 *   maps.priceCents['pro']  // 49700
 *   maps.label['pro']       // 'Pro'
 */
import { db } from '@/lib/db'

export interface PlanMaps {
  priceCents: Record<string, number>
  label: Record<string, string>
  name: Record<string, string>
  slugs: string[]
}

function shortLabelFromName(name: string): string {
  const idx = name.lastIndexOf('·')
  return idx >= 0 ? name.slice(idx + 1).trim() : name
}

export async function loadPlanMaps(opts: { activeOnly?: boolean } = {}): Promise<PlanMaps> {
  const plans = await db.plan.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, name: true, priceCents: true },
  })

  const priceCents: Record<string, number> = {}
  const label: Record<string, string> = {}
  const name: Record<string, string> = {}
  const slugs: string[] = []

  for (const p of plans) {
    priceCents[p.slug] = p.priceCents
    label[p.slug] = shortLabelFromName(p.name)
    name[p.slug] = p.name
    slugs.push(p.slug)
  }

  return { priceCents, label, name, slugs }
}

/**
 * Atalho para somar MRR a partir de subscriptions cujo plan é o slug.
 */
export function sumMrrCents(
  subs: Array<{ plan: string }>,
  maps: PlanMaps
): number {
  return subs.reduce((acc, s) => acc + (maps.priceCents[s.plan] ?? 0), 0)
}
