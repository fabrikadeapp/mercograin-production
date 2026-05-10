/**
 * Testes trabalho-escravo adapter (sem DB real).
 * Executar: npx tsx lib/compliance/trabalho-escravo.test.ts
 *
 * Estratégia: substitui `db.listaSuja.findMany` por stub após o import,
 * já que o handler chama `db` lazy a cada invocação.
 */
import { db } from '@/lib/db'
import { consultarTrabalhoEscravo } from './trabalho-escravo'

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

// Override do método findMany
let stubRows: any[] = []
;(db as any).listaSuja = {
  async findMany(args: any) {
    return stubRows.filter(
      (r: any) =>
        r.cnpjOuCpf === args.where.cnpjOuCpf && r.lista === args.where.lista,
    )
  },
}

async function run() {
  console.log('# trabalho-escravo adapter')

  // CPF/CNPJ inválido
  stubRows = []
  const r0 = await consultarTrabalhoEscravo('123')
  assert(r0.fonte === 'mock', 'invalido retorna mock')
  assert(!r0.temRegistro, 'invalido sem registro')

  // CNPJ válido sem matches
  const r1 = await consultarTrabalhoEscravo('11.222.333/0001-44')
  assert(r1.cnpjOuCpf === '11222333000144', 'CNPJ limpo')
  assert(!r1.temRegistro, 'sem matches')
  assert(r1.fonte === 'mock', 'fonte mock quando vazio')

  // Com match
  stubRows = [
    {
      cnpjOuCpf: '11222333000144',
      lista: 'trabalho_escravo',
      nome: 'Fazenda Teste',
      uf: 'PA',
      municipio: 'Marabá',
      detalhes: { periodoFiscalizacao: '2024' },
    },
  ]
  const r2 = await consultarTrabalhoEscravo('11.222.333/0001-44')
  assert(r2.temRegistro, 'match retorna temRegistro=true')
  assert(r2.fonte === 'gov_br', 'fonte gov_br quando há match')
  assert(r2.registros[0]?.uf === 'PA', 'UF preservada')
  assert(r2.registros[0]?.periodoFiscalizacao === '2024', 'periodoFiscalizacao mapeado')

  console.log(`\nTotal: ${pass} pass / ${fail} fail`)
  if (fail > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
