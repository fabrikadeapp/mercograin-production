/**
 * Tests para gerador SPED Fiscal.
 * Run: npx tsx lib/fiscal/sped/fiscal.test.ts
 */
import { gerarSpedFiscal } from './fiscal'
import { gerarSpedContribuicoes } from './contribuicoes'

let pass = 0, fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const config: any = {
  id: 'cfg1',
  workspaceId: 'ws1',
  regimeTributario: 'lucro_presumido',
  cnpjEmissor: '12345678000199',
}

const empresa = {
  razaoSocial: 'CORRETORA TESTE LTDA',
  cnpj: '12345678000199',
  uf: 'RS',
  inscricaoEstadual: '0900012345',
  codigoMunicipioIBGE: '4314902',
}

const notaSample: any = {
  id: 'nf1',
  workspaceId: 'ws1',
  configFiscalId: 'cfg1',
  tipo: 'saida',
  modelo: '55',
  serie: 1,
  numero: 1001,
  chave: '43250112345678000199550010000010011234567890',
  status: 'autorizada',
  dataEmissao: new Date('2026-04-15'),
  dataAutorizacao: new Date('2026-04-15'),
  destinatarioDoc: '98765432000111',
  destinatarioNome: 'DESTINATARIO TESTE SA',
  destinatarioUF: 'SC',
  destinatarioIE: '254123456',
  emitenteCnpj: '12345678000199',
  emitenteNome: 'CORRETORA TESTE',
  emitenteUF: 'RS',
  itens: [
    {
      codigo: 'SOJA',
      descricao: 'Soja em grão',
      ncm: '12019000',
      cfop: '6101',
      qtd: 1000,
      unidade: 'SC',
      valorUnitario: 130,
      valorTotal: 130000,
      valorPIS: 0,
      valorCOFINS: 0,
      valorICMS: 9100,
      aliquotaICMS: 7,
    },
  ],
  valorProdutos: 130000,
  valorICMS: 9100,
  valorPIS: 0,
  valorCOFINS: 0,
  valorFUNRURAL: 0,
  valorFrete: 0,
  valorOutros: 0,
  valorTotal: 130000,
  cfopPrincipal: '6101',
  naturezaOperacao: 'Venda',
  finalidadeEmissao: '1',
  intermunicipal: false,
  interestadual: true,
  diferimentoICMS: false,
}

;(async () => {
  console.log('\n== SPED Fiscal — 1 nota ==')
  {
    const out = await gerarSpedFiscal({ config, competencia: '202604', empresa, notas: [notaSample] })
    assert(out.conteudo.includes('|0000|'), 'Tem registro 0000')
    assert(out.conteudo.includes('|0990|'), 'Tem registro 0990 (fecha bloco 0)')
    assert(out.conteudo.includes('|C100|'), 'Tem registro C100 (cabeçalho NF-e)')
    assert(out.conteudo.includes('|C170|'), 'Tem registro C170 (itens)')
    assert(out.conteudo.includes('|9999|'), 'Tem totalizador 9999')
    assert(out.conteudo.includes('43250112345678000199550010000010011234567890'), 'Chave NF-e no arquivo')
    assert(out.totalRegistros > 10, `Mais de 10 registros (got ${out.totalRegistros})`)
    assert(/^[a-f0-9]{32}$/.test(out.hash), 'Hash MD5 32 chars')
    // CRLF
    assert(out.conteudo.includes('\r\n'), 'EOL é CRLF')
  }

  console.log('\n== SPED Fiscal — 0 notas (arquivo vazio mas válido) ==')
  {
    const out = await gerarSpedFiscal({ config, competencia: '202604', empresa, notas: [] })
    assert(out.conteudo.includes('|0000|'), 'Mesmo vazio tem 0000')
    assert(out.conteudo.includes('|C001|1|'), 'C001 com indicador 1 (sem movimento)')
    assert(out.conteudo.includes('|9999|'), 'Tem 9999')
  }

  console.log('\n== SPED Contribuições — 1 nota ==')
  {
    const out = await gerarSpedContribuicoes({ config, competencia: '202604', empresa, notas: [notaSample] })
    assert(out.conteudo.includes('|0000|'), '0000 presente')
    assert(out.conteudo.includes('|C100|'), 'C100 presente')
    assert(out.conteudo.includes('|C170|'), 'C170 presente')
    assert(out.conteudo.includes('|M001|'), 'M001 presente (apuração)')
    assert(out.conteudo.includes('|9999|'), '9999 presente')
  }

  console.log(`\nResultado: ${pass} PASS / ${fail} FAIL`)
  if (fail > 0) process.exit(1)
})()
