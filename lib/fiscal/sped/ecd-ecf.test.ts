/**
 * Tests para geradores ECD e ECF.
 * Run: npx tsx lib/fiscal/sped/ecd-ecf.test.ts
 */
import { gerarECD } from './ecd'
import { gerarECF } from './ecf'

let pass = 0, fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const empresa = {
  razaoSocial: 'BH GRAIN LTDA',
  cnpj: '12345678000199',
  uf: 'RS',
  inscricaoEstadual: '0900012345',
  codigoMunicipioIBGE: '4314902',
}

;(async () => {
  console.log('# ECD')
  const ecd = await gerarECD({
    workspaceId: 'ws1',
    anoFiscal: 2025,
    empresa,
    planoContas: [
      { codigo: '1.1.01.001', nivel: 4, tipo: 'A', natureza: '1', descricao: 'Caixa' },
      { codigo: '3.1.01.001', nivel: 4, tipo: 'A', natureza: '3', descricao: 'Capital social' },
    ],
    lancamentos: [
      { numero: '1', data: new Date('2025-01-15'), contaDebito: '1.1.01.001', contaCredito: '3.1.01.001', valor: 100000, historico: 'Integralização' },
    ],
    dre: [
      { codigoConta: '3.5.01', descricao: 'Receita bruta', valor: 500000, tipo: 'R' },
      { codigoConta: '3.6.01', descricao: 'Custos', valor: 300000, tipo: 'D' },
    ],
  })
  assert(ecd.conteudo.includes('|0000|LECD|'), 'ECD 0000 LECD')
  assert(ecd.conteudo.includes('|I050|'), 'ECD I050 plano contas')
  assert(ecd.conteudo.includes('|I200|') && ecd.conteudo.includes('|I250|'), 'ECD I200+I250 lançamentos')
  assert(ecd.conteudo.includes('|J150|'), 'ECD J150 DRE')
  assert(ecd.conteudo.includes('|9999|'), 'ECD 9999 totalizador')
  assert(ecd.totalRegistros > 0 && ecd.hash.length === 32, 'ECD totalRegistros + hash md5')
  assert(/\r\n$/.test(ecd.conteudo), 'ECD termina com CRLF')

  console.log('\n# ECF')
  const ecf = await gerarECF({
    workspaceId: 'ws1',
    anoFiscal: 2025,
    empresa,
    formaTributacao: '1',
    dadosDRE: {
      receitaBruta: 1_000_000, deducoes: 50_000, receitaLiquida: 950_000,
      custos: 600_000, lucroBruto: 350_000, despesasOperacionais: 200_000,
      resultadoOperacional: 150_000, outrasReceitas: 5000, outrasDespesas: 2000,
      lucroAntesIR: 153_000, irpj: 22_950, csll: 13_770, lucroLiquido: 116_280,
    },
    apuracoesTrimestrais: [
      { trimestre: 1, baseCalculoIRPJ: 40000, irpjDevido: 6000, irpjAdicional: 0, baseCalculoCSLL: 40000, csllDevido: 3600 },
    ],
    atividadesIncentivadas: [
      { codigo: 'EXP001', descricao: 'Exportação grãos', valorReceita: 200000 },
    ],
  })
  assert(ecf.conteudo.includes('|0000|LECF|'), 'ECF 0000 LECF')
  assert(ecf.conteudo.includes('|0010|'), 'ECF 0010 params tributação')
  assert(ecf.conteudo.includes('|N500|'), 'ECF N500 DRE')
  assert(ecf.conteudo.includes('|N620|') && ecf.conteudo.includes('|N630|'), 'ECF N620 CSLL + N630 IRPJ')
  assert(ecf.conteudo.includes('|P150|'), 'ECF P150 apuração trimestral')
  assert(ecf.conteudo.includes('|Y570|'), 'ECF Y570 atividade incentivada')
  assert(ecf.conteudo.includes('|9999|'), 'ECF 9999 totalizador')

  console.log(`\nResultado: ${pass} passou, ${fail} falhou`)
  process.exit(fail > 0 ? 1 : 0)
})()
