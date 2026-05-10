/**
 * Testes CGU adapter.
 * Executar: npx ts-node lib/compliance/cgu.test.ts
 */
import { consultarSancoesCGU } from './cgu'

let pass = 0
let fail = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    pass++
    console.log('  PASS:', label)
  } else {
    fail++
    console.error('  FAIL:', label)
  }
}

async function run() {
  console.log('# CGU adapter')

  // CNPJ inválido (formato)
  const r1 = await consultarSancoesCGU('123')
  assert(r1.fonte === 'mock', 'CNPJ curto retorna mock')
  assert(r1.erros?.includes('cnpj_invalido') === true, 'erro cnpj_invalido marcado')

  // CNPJ válido sem token configurado (CGU_API_TOKEN ausente em test)
  const prevToken = process.env.CGU_API_TOKEN
  delete process.env.CGU_API_TOKEN

  const r2 = await consultarSancoesCGU('11.222.333/0001-44')
  assert(r2.cnpj === '11222333000144', 'CNPJ é limpo')
  assert(r2.fonte === 'mock', 'sem token retorna mock')
  assert(r2.ceis.temRegistro === false, 'ceis vazio sem token')
  assert(r2.cnep.temRegistro === false, 'cnep vazio sem token')
  assert(r2.cepim.temRegistro === false, 'cepim vazio sem token')

  // shape
  assert(typeof r2.consultadoEm === 'string', 'consultadoEm preenchido')

  if (prevToken) process.env.CGU_API_TOKEN = prevToken

  console.log(`\nTotal: ${pass} pass / ${fail} fail`)
  if (fail > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
