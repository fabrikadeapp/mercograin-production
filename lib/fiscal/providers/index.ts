/**
 * Factory: retorna provider correto p/ workspace.
 *
 * Política nova (sem mock silencioso):
 *  - Se ConfiguracaoFiscal aponta para um provider real E a credencial
 *    correspondente está no env → retorna o adapter real.
 *  - Caso contrário → retorna DisabledFiscalProvider, que rejeita toda
 *    operação com mensagem explícita. Nunca grava URLs fake.
 *  - 'mock' continua disponível APENAS sob NODE_ENV='test' (test fixtures).
 *
 * Para ativar NFE.io em produção:
 *   1. Configurar NFEIO_API_KEY no env
 *   2. ConfiguracaoFiscal.providerNome = 'nfeio'
 *   3. ConfiguracaoFiscal.providerCompanyId = '<id da empresa NFE.io>'
 */

import { db } from '@/lib/db'
import type { FiscalProvider } from './types'
import { DisabledFiscalProvider } from './disabled'
import { MockProvider } from './mock'
import { NFEioProvider } from './nfeio'

function disabled(reason: string): FiscalProvider {
  console.warn(`[fiscal] provider desligado: ${reason}`)
  return new DisabledFiscalProvider()
}

export async function getProvider(workspaceId: string): Promise<FiscalProvider> {
  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId } })
  if (!cfg) return disabled('sem ConfiguracaoFiscal')

  switch (cfg.providerNome) {
    case 'nfeio': {
      const apiKey = process.env.NFEIO_API_KEY
      if (!apiKey || !cfg.providerCompanyId) {
        return disabled('NFEIO_API_KEY ou providerCompanyId ausente')
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
      return disabled(`provider ${cfg.providerNome} ainda não implementado`)
    case 'mock':
      // Mantido só para testes automatizados.
      if (process.env.NODE_ENV === 'test') return new MockProvider()
      return disabled('provider=mock em ambiente não-test')
    default:
      return disabled(`providerNome desconhecido: ${cfg.providerNome}`)
  }
}

export type { FiscalProvider } from './types'
export { DisabledFiscalProvider } from './disabled'
export { MockProvider } from './mock'
export { NFEioProvider } from './nfeio'
