/**
 * withWorkspaceContext — executa um bloco com app.workspace_id setado
 * na conexão Postgres.
 *
 * Combinado com RLS policies em Cliente/Proposta/Contrato/Boleto/Comissao,
 * isso garante isolation a nível de banco — mesmo que um bug no código
 * faça query sem filtro de workspace, o Postgres bloqueia.
 *
 * Como funciona:
 *  1. Inicia transação
 *  2. SET LOCAL app.workspace_id = '<id>'
 *  3. Executa o callback (todas as queries dentro herdam o setting)
 *  4. Commit / Rollback
 *
 * O `LOCAL` garante que o setting só vale dentro da transação — não
 * vaza pra próxima conexão pego do pool.
 *
 * Uso:
 *   const proposta = await withWorkspaceContext(scope.workspaceId, async (tx) => {
 *     return tx.proposta.create({ data: {...} })
 *   })
 *
 * Limitação: cada call abre uma transação. Pra operações muito read-only
 * pode ser overhead. Use só quando precisar da garantia RLS.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function withWorkspaceContext<T>(
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    // SET LOCAL escapa identificador via parameterized query interna
    // Workspace ID é cuid (cmxxx...) — sem risco de SQL injection mas
    // ainda assim sanitizamos
    const safeId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')
    if (safeId !== workspaceId) {
      throw new Error('workspace_id inválido')
    }
    await tx.$executeRawUnsafe(`SET LOCAL app.workspace_id = '${safeId}'`)
    return fn(tx)
  })
}

/**
 * Versão simplificada: roda uma query rápida com contexto.
 * Útil em handlers que fazem 1 só operação.
 */
export async function queryWithWorkspace<T>(
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withWorkspaceContext(workspaceId, fn)
}
