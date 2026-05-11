/**
 * Helper para redirecionar páginas legadas para suas versões -vg quando o
 * super-admin ativou o tema VisionGlass globalmente.
 *
 * Uso (no topo do server component da página legada):
 *
 *   await redirectIfVgEnabled('/contratos-vg')
 *
 * Se o tema atual é 'visionglass', dispara redirect(). Se é 'phb', no-op.
 */
import { redirect } from 'next/navigation'
import { getUiTheme } from './theme'

export async function redirectIfVgEnabled(vgPath: string): Promise<void> {
  const theme = await getUiTheme().catch(() => 'phb' as const)
  if (theme === 'visionglass') {
    redirect(vgPath)
  }
}
