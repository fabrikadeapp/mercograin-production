/**
 * Factory: retorna SignatureProvider correto pro workspace.
 * Default: MockSignatureProvider (sempre OK, sem rede).
 *
 * Para ativar ZapSign:
 *   1. Setar ZAPSIGN_API_KEY no env
 *   2. Setar ConfiguracaoFiscal.providerNome = 'zapsign'
 *      (reaproveitamos o mesmo enum p/ não criar tabela só pra isso)
 *
 * Sem workspaceId, devolve provider baseado em env (CLI / cron sem tenant).
 */
import { db } from '@/lib/db'
import type { SignatureProvider } from './types'
import { MockSignatureProvider } from './mock'
import { ZapSignProvider } from './zapsign'
import { NativeSignatureProvider } from './native'

const SIGNATURE_PROVIDERS = new Set([
  'mock',
  'native',
  'zapsign',
  'clicksign',
  'd4sign',
])

export async function getSignatureProvider(
  workspaceId?: string
): Promise<SignatureProvider> {
  // Default = 'native' (nosso provider próprio, sem dependência externa).
  // Mock fica disponível só explicitamente para testes.
  let providerNome = process.env.SIGNATURE_PROVIDER || 'native'

  if (workspaceId) {
    const cfg = await db.configuracaoFiscal
      .findUnique({ where: { workspaceId } })
      .catch(() => null)
    if (cfg && SIGNATURE_PROVIDERS.has(cfg.providerNome)) {
      providerNome = cfg.providerNome
    }
  }

  switch (providerNome) {
    case 'zapsign': {
      const apiKey = process.env.ZAPSIGN_API_KEY
      if (!apiKey) {
        console.warn(
          '[signature] ZapSign selecionado mas ZAPSIGN_API_KEY ausente — usando MOCK'
        )
        return new MockSignatureProvider()
      }
      return new ZapSignProvider(apiKey)
    }
    case 'clicksign':
    case 'd4sign':
      console.warn(
        `[signature] Provider ${providerNome} ainda não implementado — usando NATIVE`
      )
      return new NativeSignatureProvider()
    case 'mock':
      return new MockSignatureProvider()
    case 'native':
    default:
      return new NativeSignatureProvider()
  }
}

export type {
  SignatureProvider,
  SignaturePayload,
  SignatureResponse,
  SignatureStatus,
  AuthMode,
  Signatario,
  SignatureStatusValue,
} from './types'
export { MockSignatureProvider } from './mock'
export { ZapSignProvider, verifyWebhookSignature } from './zapsign'
export { NativeSignatureProvider } from './native'
