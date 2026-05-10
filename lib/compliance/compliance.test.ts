/**
 * Tests para lib/compliance — aprovação, OFX, curva ABC, classificação DRE.
 * Run: npx tsx lib/compliance/compliance.test.ts
 */
import {
  deveDispararWorkflow,
  processarDecisao,
  calcularPrazoInicial,
  podeAprovarEtapa,
} from './aprovacao'
import { parseOFX, gerarHashTransacao } from './conciliacao-ofx'
import { calcularCurvaABC } from './curva-abc'
import { classificarNatureza } from './dre'

let pass = 0
let fail = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n[aprovacao]')

assert(
  deveDispararWorkflow(
    { entidade: 'contrato', condicao: { valorMinimo: 500000 }, ativo: true },
    { tipo: 'contrato', valorTotal: 750000 }
  ) === true,
  'dispara contrato acima do valor mínimo'
)

assert(
  deveDispararWorkflow(
    { entidade: 'contrato', condicao: { valorMinimo: 500000 }, ativo: true },
    { tipo: 'contrato', valorTotal: 100000 }
  ) === false,
  'não dispara contrato abaixo do valor mínimo'
)

assert(
  deveDispararWorkflow(
    { entidade: 'contrato', condicao: { valorMinimo: 1 }, ativo: false },
    { tipo: 'contrato', valorTotal: 1000000 }
  ) === false,
  'workflow inativo nunca dispara'
)

const status1 = processarDecisao(
  { etapas: [{ ordem: 1 }, { ordem: 2 }], slaHoras: 24 },
  { etapaAtual: 1, totalEtapas: 2, decisoes: [] },
  {
    aprovacaoId: 'a1',
    etapa: 1,
    aprovadorId: 'u1',
    decisao: 'aprovado',
  }
)
assert(
  status1.proximaEtapa === 2 && status1.status === 'pendente',
  'aprovação avança para etapa 2'
)

const status2 = processarDecisao(
  { etapas: [{ ordem: 1 }], slaHoras: 24 },
  { etapaAtual: 1, totalEtapas: 1, decisoes: [] },
  {
    aprovacaoId: 'a1',
    etapa: 1,
    aprovadorId: 'u1',
    decisao: 'aprovado',
  }
)
assert(
  status2.status === 'aprovada' && status2.proximaEtapa === null,
  'última etapa aprovada finaliza com status aprovada'
)

const status3 = processarDecisao(
  { etapas: [{ ordem: 1 }, { ordem: 2 }], slaHoras: 24 },
  { etapaAtual: 1, totalEtapas: 2, decisoes: [] },
  {
    aprovacaoId: 'a1',
    etapa: 1,
    aprovadorId: 'u1',
    decisao: 'rejeitado',
    motivo: 'fora do orçamento',
  }
)
assert(
  status3.status === 'rejeitada' && status3.bloqueado === true,
  'rejeição bloqueia fluxo'
)

const prazo = calcularPrazoInicial(
  48,
  new Date('2026-01-01T00:00:00Z')
)
assert(
  prazo.toISOString() === '2026-01-03T00:00:00.000Z',
  'prazo inicial = agora + slaHoras'
)

assert(podeAprovarEtapa({ ordem: 1, role: 'admin', nome: 'X' }, 'owner'), 'owner aprova etapa admin')
assert(!podeAprovarEtapa({ ordem: 1, role: 'admin', nome: 'X' }, 'member'), 'member não aprova etapa admin')

console.log('\n[conciliacao-ofx]')

const ofxV1 = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260301
<TRNAMT>1500.50
<FITID>BR-001
<MEMO>Recebimento contrato CT-001
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260302120000
<TRNAMT>-250.00
<FITID>BR-002
<MEMO>Tarifa
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

const transV1 = parseOFX(ofxV1)
assert(transV1.length === 2, 'OFX 1.x: parseia 2 transações')
assert(
  transV1[0].tipo === 'CREDIT' && transV1[0].valor === 1500.5,
  'OFX 1.x: lê CREDIT 1500.50'
)
assert(
  transV1[1].tipo === 'DEBIT' && transV1[1].identificadorBanco === 'BR-002',
  'OFX 1.x: lê DEBIT com FITID correto'
)
assert(
  transV1[0].hash !== transV1[1].hash && transV1[0].hash.length === 64,
  'OFX: hashes únicos e válidos'
)

const h1 = gerarHashTransacao({
  data: new Date('2026-03-01T00:00:00Z'),
  valor: 1500.5,
  identificadorBanco: 'BR-001',
})
const h2 = gerarHashTransacao({
  data: new Date('2026-03-01T00:00:00Z'),
  valor: 1500.5,
  identificadorBanco: 'BR-001',
})
assert(h1 === h2, 'hash determinístico')

const ofxV2 = `<?xml version="1.0"?>
<OFX>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260105</DTPOSTED>
<TRNAMT>999.00</TRNAMT>
<FITID>X1</FITID>
<MEMO>Test XML</MEMO>
</STMTTRN>
</OFX>`
const transV2 = parseOFX(ofxV2)
assert(
  transV2.length === 1 && transV2[0].valor === 999,
  'OFX 2.x (XML): parseia transação'
)

console.log('\n[curva-abc]')

const itens = [
  { id: 'a', total: 8000 },
  { id: 'b', total: 1500 },
  { id: 'c', total: 300 },
  { id: 'd', total: 200 },
]
const curva = calcularCurvaABC(itens, (x) => x.total)
assert(curva.length === 4, 'curva retorna mesmo número de itens')
assert(curva[0].item.id === 'a', 'maior valor é o primeiro')
assert(curva[0].classificacao === 'A', 'item dominante é A')
assert(
  curva.find((x) => x.item.id === 'd')!.classificacao === 'C',
  'item residual é C'
)
assert(
  Math.abs(curva[curva.length - 1].percentualAcumulado - 100) < 0.5,
  'percentual acumulado fecha em 100%'
)

const curvaVazia = calcularCurvaABC([{ id: 'x', v: 0 }], (x) => x.v)
assert(curvaVazia[0].classificacao === 'C', 'sem valor: classificação C')

console.log('\n[dre]')

assert(
  classificarNatureza('receita', 'comissao') === 'receitaComissoes',
  'receita comissão classificada'
)
assert(
  classificarNatureza('receita', 'venda_grao') === 'receitaBrutaVendas',
  'receita default vai para vendas'
)
assert(
  classificarNatureza('despesa', 'icms') === 'deducoesImpostos',
  'imposto vai para deduções'
)
assert(
  classificarNatureza('despesa', 'frete') === 'despesasComerciais',
  'frete vai para despesas comerciais'
)
assert(
  classificarNatureza('despesa', 'juros') === 'despesasFinanceiras',
  'juros vai para despesas financeiras'
)

console.log(`\nTotal: ${pass} pass / ${fail} fail`)
if (fail > 0) process.exit(1)
