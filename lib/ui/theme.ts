/**
 * Helper para o tema de design.
 *
 * Atualmente o produto opera com tema único (NewDB v2), aplicado globalmente
 * via styles/newdb.css + newdb-overlay.css. Este módulo é mantido para o
 * endpoint admin/design e usos futuros (ex.: light theme toggle).
 */
import { db } from '@/lib/db'

export type UiTheme = 'phb'

const CONFIG_KEY = 'ui.theme'
const TTL_MS = 30_000
let cache: { value: UiTheme; at: number } | null = null

export const AVAILABLE_THEMES: { id: UiTheme; label: string; description: string }[] = [
  {
    id: 'phb',
    label: 'NewDB v2 (padrão)',
    description: 'Tema único do produto. Lime accent (#C8F051) sobre dark, tipografia Inter/JetBrains/Instrument Serif.',
  },
]

export async function getUiTheme(): Promise<UiTheme> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.value
  try {
    await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    cache = { value: 'phb', at: now }
    return 'phb'
  } catch {
    return 'phb'
  }
}

export async function setUiTheme(_theme: UiTheme, updatedBy?: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: { theme: 'phb' } as object, updatedBy },
    update: { value: { theme: 'phb' } as object, updatedBy },
  })
  cache = { value: 'phb', at: Date.now() }
}
