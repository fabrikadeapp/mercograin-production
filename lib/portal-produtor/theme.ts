/**
 * Tema do portal: light (default) ou dark.
 * Persistido em cookie `portal_theme=light|dark` (server reads, hydrate sem flash).
 */
import { cookies } from 'next/headers'

export const PORTAL_THEME_COOKIE = 'portal_theme'

export type PortalTheme = 'light' | 'dark'

export async function getPortalTheme(): Promise<PortalTheme> {
  try {
    const c = await cookies()
    const v = c.get(PORTAL_THEME_COOKIE)?.value
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}
