import { db } from '@/lib/db'

/**
 * Gera próximo número de Ordem de Carga no formato OC-{YYYY}-{NNN}
 * sequencial por workspace e por ano corrente.
 */
export async function proximoNumeroOC(workspaceId: string): Promise<string> {
  const ano = new Date().getFullYear()
  const last = await db.ordemCarga.findFirst({
    where: { workspaceId, numero: { startsWith: `OC-${ano}-` } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const lastSeq = last ? parseInt(last.numero.split('-')[2] || '0', 10) || 0 : 0
  return `OC-${ano}-${String(lastSeq + 1).padStart(3, '0')}`
}
