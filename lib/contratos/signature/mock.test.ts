/**
 * Tests para MockSignatureProvider — fluxo completo: send → status → cancel.
 * Run: npx tsx lib/contratos/signature/mock.test.ts
 */
import { MockSignatureProvider } from './mock'
import type { SignaturePayload } from './types'

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

function basePayload(): SignaturePayload {
  return {
    contractId: 'ctr_test_1',
    contractNumber: 'CTR-2026-0001',
    pdfBuffer: Buffer.from('FAKE-PDF-CONTENT'),
    pdfFileName: 'contrato.pdf',
    pdfHash: 'a'.repeat(64),
    signatories: [
      {
        name: 'João Produtor',
        cpfCnpj: '11122233344',
        email: 'joao@example.com',
        authMode: 'simple',
      },
      {
        name: 'Maria Corretora',
        cpfCnpj: '55566677788',
        email: 'maria@example.com',
        authMode: 'icp_brasil',
      },
    ],
  }
}

async function main() {
  console.log('\nMockSignatureProvider — fluxo completo')
  MockSignatureProvider.__reset()

  const provider = new MockSignatureProvider()
  assert(provider.isReady() === true, 'isReady() retorna true')
  assert(provider.name === 'mock', 'name = mock')

  // send
  const sendResp = await provider.send(basePayload())
  assert(sendResp.ok === true, 'send retorna ok=true')
  assert(
    typeof sendResp.providerDocId === 'string' &&
      sendResp.providerDocId.startsWith('mock_'),
    'providerDocId gerado'
  )
  assert(sendResp.signUrls.length === 2, '2 signUrls criadas')
  assert(
    sendResp.signUrls.every((u) => u.url.startsWith('https://')),
    'signUrls são https'
  )
  assert(sendResp.status === 'pendente', 'status inicial = pendente')

  // status — pendente
  const st1 = await provider.status(sendResp.providerDocId)
  assert(st1.status === 'pendente', 'status() devolve pendente')
  assert(st1.signatories.length === 2, 'signatários presentes no status')
  assert(
    st1.signatories.every((s) => s.signedAt === null),
    'nenhum signatário assinou ainda'
  )

  // simula assinatura
  MockSignatureProvider.__markSigned(sendResp.providerDocId)
  const st2 = await provider.status(sendResp.providerDocId)
  assert(st2.status === 'assinado', 'após markSigned, status = assinado')
  assert(
    st2.signatories.every((s) => s.signedAt instanceof Date),
    'todos signatários têm signedAt'
  )
  assert(
    typeof st2.signedPdfHash === 'string' && st2.signedPdfHash.length === 64,
    'signedPdfHash é SHA-256 (64 hex chars)'
  )

  // download
  const buf = await provider.downloadSignedPdf(sendResp.providerDocId)
  assert(Buffer.isBuffer(buf) && buf.length > 0, 'downloadSignedPdf retorna Buffer')
  assert(
    buf.toString('utf8').includes('MOCK-SIGNED-PDF'),
    'PDF assinado contém prefixo mock'
  )

  // cancel — motivo curto rejeita
  const c1 = await provider.cancel('mock_does_not_exist', 'x')
  assert(c1.ok === false, 'cancel com motivo curto rejeita')

  // cancel ok em outro doc
  const sendResp2 = await provider.send(basePayload())
  const c2 = await provider.cancel(sendResp2.providerDocId, 'desistência cliente')
  assert(c2.ok === true, 'cancel com motivo válido OK')
  const st3 = await provider.status(sendResp2.providerDocId)
  assert(st3.status === 'cancelado', 'status pós-cancel = cancelado')

  // doc inexistente — status devolve pendente vazio (não throw)
  const st4 = await provider.status('mock_nonexistent')
  assert(st4.status === 'pendente', 'status de docId inexistente = pendente')
  assert(st4.signatories.length === 0, 'signatários vazios em docId inexistente')

  console.log(`\n  ${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
