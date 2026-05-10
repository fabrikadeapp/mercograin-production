/**
 * Tests para a factory de SignatureProvider.
 * Run: npx tsx lib/contratos/signature/index.test.ts
 *
 * Não tocamos o DB: forçamos workspaceId=undefined e variamos env.
 */
import { getSignatureProvider } from './index'
import { MockSignatureProvider } from './mock'
import { ZapSignProvider } from './zapsign'

let pass = 0,
  fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  console.log('\nSignature factory — env-only (workspaceId omitido)')

  const oldKey = process.env.ZAPSIGN_API_KEY
  const oldProv = process.env.SIGNATURE_PROVIDER

  // 1. Default: mock
  delete process.env.SIGNATURE_PROVIDER
  delete process.env.ZAPSIGN_API_KEY
  const p1 = await getSignatureProvider()
  assert(p1 instanceof MockSignatureProvider, 'default factory = Mock')

  // 2. Provider=zapsign mas sem API key → fallback Mock
  process.env.SIGNATURE_PROVIDER = 'zapsign'
  delete process.env.ZAPSIGN_API_KEY
  const p2 = await getSignatureProvider()
  assert(
    p2 instanceof MockSignatureProvider,
    'zapsign sem API_KEY → fallback Mock'
  )

  // 3. Provider=zapsign + API key → ZapSignProvider
  process.env.SIGNATURE_PROVIDER = 'zapsign'
  process.env.ZAPSIGN_API_KEY = 'test_key_dummy'
  const p3 = await getSignatureProvider()
  assert(p3 instanceof ZapSignProvider, 'zapsign+key → ZapSignProvider')
  assert(p3.isReady() === true, 'ZapSignProvider.isReady() com key')

  // 4. Provider unknown → fallback Mock
  process.env.SIGNATURE_PROVIDER = 'clicksign'
  const p4 = await getSignatureProvider()
  assert(
    p4 instanceof MockSignatureProvider,
    'provider não implementado → Mock'
  )

  // restore env
  if (oldKey === undefined) delete process.env.ZAPSIGN_API_KEY
  else process.env.ZAPSIGN_API_KEY = oldKey
  if (oldProv === undefined) delete process.env.SIGNATURE_PROVIDER
  else process.env.SIGNATURE_PROVIDER = oldProv

  console.log(`\n  ${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
