/**
 * Geração de números sequenciais por workspace para Romaneio, Ticket, Lote.
 * Formato: PREFIX-YYYY-NNNNN (zero-padded 5 dígitos).
 */
import { db } from '@/lib/db'

type EntityKind = 'romaneio' | 'ticket' | 'lote'

const PREFIX: Record<EntityKind, string> = {
  romaneio: 'ROM',
  ticket: 'TKT',
  lote: 'LOTE',
}

export async function nextNumero(
  kind: EntityKind,
  workspaceId: string
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${PREFIX[kind]}-${year}-`

  let count: number
  switch (kind) {
    case 'romaneio':
      count = await db.romaneio.count({
        where: { workspaceId, numero: { startsWith: prefix } },
      })
      break
    case 'ticket':
      count = await db.ticketBalanca.count({
        where: { workspaceId, numero: { startsWith: prefix } },
      })
      break
    case 'lote':
      count = await db.loteEstoque.count({
        where: { workspaceId, numero: { startsWith: prefix } },
      })
      break
  }
  const seq = String(count + 1).padStart(5, '0')
  return `${prefix}${seq}`
}
