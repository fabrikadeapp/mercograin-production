/**
 * Helper para o seletor global de tema de design.
 *
 * SystemConfig['ui.theme'] = 'phb' (padrão atual) | 'visionglass'
 *
 * Aplica no <html data-theme="..."> via layout root. CSS pode opcionalmente
 * usar [data-theme='visionglass'] como prefixo para overrides — por ora a
 * estética VisionGlass é aplicada explicitamente em classes `vg-*` e na rota
 * /dashboard-vg, então o data-theme funciona como flag visível + ponto de
 * extensão futuro.
 */
import { db } from '@/lib/db'

export type UiTheme = 'phb' | 'visionglass'

const CONFIG_KEY = 'ui.theme'
const TTL_MS = 30_000
let cache: { value: UiTheme; at: number } | null = null

export const AVAILABLE_THEMES: { id: UiTheme; label: string; description: string }[] = [
  {
    id: 'phb',
    label: 'PHB Grain (padrão)',
    description: 'Tema institucional escuro do PHB Grain. Densidade alta, foco em dados.',
  },
  {
    id: 'visionglass',
    label: 'VisionGlass',
    description:
      'Glassmorphism inspirado em visionOS. Tipografia gigante, cards translúcidos, dock flutuante. Disponível em /dashboard-vg como preview.',
  },
]

export async function getUiTheme(): Promise<UiTheme> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.value
  try {
    const row = await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    const v = (row?.value as any)?.theme
    const value: UiTheme = v === 'visionglass' ? 'visionglass' : 'phb'
    cache = { value, at: now }
    return value
  } catch {
    return 'phb'
  }
}

export async function setUiTheme(theme: UiTheme, updatedBy?: string): Promise<void> {
  const value = theme === 'visionglass' ? 'visionglass' : 'phb'
  await db.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: { theme: value } as object, updatedBy },
    update: { value: { theme: value } as object, updatedBy },
  })
  cache = { value, at: Date.now() }
}
