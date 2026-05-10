/**
 * Factory: retorna provider correto p/ workspace.
 * Default: MockProvider (NÃO chama API real).
 *
 * Para ativar NFE.io em produção:
 *   1. Configurar NFEIO_API_KEY no .env
 *   2. ConfiguracaoFiscal.providerNome = 'nfeio'
 *   3. ConfiguracaoFiscal.providerCompanyId = '<id da empresa NFE.io>'
 */

import { db } from '@/lib/db'
import type { FiscalProvider } from './types'
import { MockProvider } from './mock'
import { NFEioProvider } from './nfeio'

export async function getProvider(workspaceId: string): Promise<FiscalProvider> {
  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId } })
  if (!cfg) return new MockProvider()

  switch (cfg.providerNome) {
    case 'nfeio': {
      const apiKey = process.env.NFEIO_API_KEY
      if (!apiKey || !cfg.providerCompanyId) {
        console.warn(`[fiscal] NFE.io configurado mas NFEIO_API_KEY ou companyId ausente — usando MOCK`)
        return new MockProvider()
      }
      return new NFEioProvider(
        apiKey,
        cfg.providerCompanyId,
        (cfg.ambiente as 'homologacao' | 'producao') || 'homologacao'
      )
    }
    case 'enotas':
    case 'webmania':
    case 'tecnospeed':
      // TODO: adapters específicos. Por enquanto mock + log.
      console.warn(`[fiscal] Provider ${cfg.providerNome} ainda não implementado — usando MOCK`)
      return new MockProvider()
    case 'mock':
    default:
      return new MockProvider()
  }
}

export type { FiscalProvider } from './types'
export { MockProvider } from './mock'
export { NFEioProvider } from './nfeio'
