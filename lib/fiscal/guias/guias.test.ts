/**
 * Tests para geradores de guias DARF/GNRE/GARE + simulador UF.
 * Run: npx tsx lib/fiscal/guias/guias.test.ts
 */
import { gerarDARF } from './darf'
import { gerarGNRE } from './gnre'
import { gerarGARE } from './gare'
import { dvMod10, dvMod11, montarCodigoBarrasArrecadacao } from './util'
import { simularTributacao } from '../simulador-uf'

let pass = 0, fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('# util — DV mod10/mod11')
assert(dvMod10('0019606200000000333000') >= 0 && dvMod10('0019606200000000333000') <= 9, 'dvMod10 dentro [0..9]')
assert(dvMod11('123456789') >= 1 && dvMod11('123456789') <= 9, 'dvMod11 mapeia 0/10/11→1')
const cb = montarCodigoBarrasArrecadacao({ segmento: '6', valor: 1234.56, empresa: '0001', campoLivre: '1'.repeat(25) })
assert(cb.codigoBarras.length === 44, 'código barras 44 dígitos')
assert(cb.linhaDigitavel.split(' ').length === 4, 'linha digitável 4 blocos')
assert(/^\d+$/.test(cb.codigoBarras), 'código barras só dígitos')

console.log('\n# DARF')
const venc = new Date('2026-06-30')
const t1 = gerarDARF({ codigo: '5952', contribuinte: { doc: '12345678000199', nome: 'EMP A' }, periodo: '202604', valor: 1000, vencimento: venc })
assert(t1.valorTotal === 1000, 'DARF sem multa/juros = valor principal')
assert(t1.codigoBarras.length === 44, 'DARF código barras 44 dig')
assert(t1.numeroDoc.startsWith('DARF-5952-202604'), 'DARF numeroDoc formato')

const t2 = gerarDARF({ codigo: '2089', contribuinte: { doc: '12345678000199', nome: 'EMP A' }, periodo: '202604', valor: 5000, multa: 100, juros: 25.5, vencimento: venc })
assert(Math.abs(t2.valorTotal - 5125.5) < 0.01, 'DARF soma multa+juros')

const t3 = gerarDARF({ codigo: '0220', contribuinte: { doc: '11122233344', nome: 'PF' }, periodo: '202601', valor: 250, vencimento: venc })
assert(t3.valorTotal === 250 && t3.linhaDigitavel.length > 0, 'DARF IRPF')

let threw = false
try { gerarDARF({ codigo: 'xxxx', contribuinte: { doc: '0', nome: 'x' }, periodo: '202601', valor: 100, vencimento: venc }) } catch { threw = true }
assert(threw, 'DARF rejeita código inválido')

let threw2 = false
try { gerarDARF({ codigo: '5952', contribuinte: { doc: '0', nome: 'x' }, periodo: '202601', valor: -10, vencimento: venc }) } catch { threw2 = true }
assert(threw2, 'DARF rejeita valor <= 0')

console.log('\n# GNRE')
const g1 = gerarGNRE({ uf: 'SP', codigo: '100099', contribuinte: { doc: '12345678000199', nome: 'EMP' }, periodo: '202604', valor: 2000, vencimento: venc })
assert(g1.uf === 'SP' && g1.codigoBarras.length === 44, 'GNRE SP gerada')
const g2 = gerarGNRE({ uf: 'mt', codigo: '100102', contribuinte: { doc: '12345678000199', nome: 'EMP' }, periodo: '202604', valor: 5000, vencimento: venc })
assert(g2.uf === 'MT', 'GNRE normaliza UF maiúscula')
const g3 = gerarGNRE({ uf: 'PR', codigo: '100137', contribuinte: { doc: '00000000000', nome: 'EMP' }, periodo: '202604', valor: 100, multa: 5, juros: 1, vencimento: venc })
assert(Math.abs(g3.valorTotal - 106) < 0.01, 'GNRE multa+juros somam')

let gThrew = false
try { gerarGNRE({ uf: 'ZZ', codigo: '100099', contribuinte: { doc: '0', nome: 'x' }, periodo: '202604', valor: 100, vencimento: venc }) } catch { gThrew = true }
assert(gThrew, 'GNRE rejeita UF inválida')

let gThrew2 = false
try { gerarGNRE({ uf: 'SP', codigo: '12345', contribuinte: { doc: '0', nome: 'x' }, periodo: '202604', valor: 100, vencimento: venc }) } catch { gThrew2 = true }
assert(gThrew2, 'GNRE rejeita código != 6 dígitos')

console.log('\n# GARE')
const ga1 = gerarGARE({ codigo: '046-2', contribuinte: { doc: '12345678000199', nome: 'EMP', ie: '111222333444' }, periodo: '202604', valor: 1500, vencimento: venc })
assert(ga1.uf === 'SP' && ga1.codigoBarras.length === 44, 'GARE SP gerada')
const ga2 = gerarGARE({ codigo: '063', contribuinte: { doc: '0', nome: 'x' }, periodo: '202604', valor: 1, vencimento: venc })
assert(ga2.codigo === '063', 'GARE aceita 3 dig')
const ga3 = gerarGARE({ codigo: '115-0', contribuinte: { doc: '12345678000199', nome: 'EMP' }, periodo: '202604', valor: 750.5, multa: 7.5, juros: 2, vencimento: venc })
assert(Math.abs(ga3.valorTotal - 760) < 0.01, 'GARE total c/ multa+juros')

let gaT = false
try { gerarGARE({ codigo: 'xx', contribuinte: { doc: '0', nome: 'x' }, periodo: '202604', valor: 1, vencimento: venc }) } catch { gaT = true }
assert(gaT, 'GARE rejeita código inválido')

let gaT2 = false
try { gerarGARE({ codigo: '046', contribuinte: { doc: '0', nome: 'x' }, periodo: '202604', valor: 0, vencimento: venc }) } catch { gaT2 = true }
assert(gaT2, 'GARE rejeita valor 0')

console.log('\n# Simulador UF')
const s1 = simularTributacao({
  origemUF: 'MT', destinoUF: 'SP', cultura: 'soja',
  valorTotal: 1_000_000, regime: 'lucro_presumido', destinatarioTipo: 'PJ',
})
assert(s1.origem.totalTributos > 0, 'Simulador retorna tributos > 0')
assert(s1.destino.totalTributos > 0, 'Simulador retorna destino')
assert(typeof s1.recomendacao === 'string', 'Simulador retorna recomendação')
// Operação interestadual MT→SP: nenhum lado tem diferimento (só aplica intra-UF)
assert(s1.origem.icms.diferido === false && s1.destino.icms.diferido === false, 'Interestadual sem diferimento')
const sIntra = simularTributacao({ origemUF: 'MT', destinoUF: 'MT', cultura: 'soja', valorTotal: 1_000_000, regime: 'lucro_presumido', destinatarioTipo: 'PJ' })
assert(sIntra.origem.icms.diferido === true, 'MT intra-UF com PJ → ICMS diferido')

const s2 = simularTributacao({
  origemUF: 'RS', destinoUF: 'SC', cultura: 'milho',
  valorTotal: 500_000, regime: 'lucro_real', destinatarioTipo: 'PJ',
})
assert(s2.origem.icms.aliquota === 12, 'Sul→Sul interestadual 12%')

const s3 = simularTributacao({
  origemUF: 'MG', destinoUF: 'BA', cultura: 'cafe',
  valorTotal: 100_000, regime: 'simples', destinatarioTipo: 'PJ',
})
assert(s3.origem.pis.valor === 0 && s3.origem.cofins.valor === 0, 'Simples → PIS/COFINS zerados')

const s4 = simularTributacao({
  origemUF: 'SP', destinoUF: 'SP', cultura: 'soja',
  valorTotal: 200_000, regime: 'lucro_presumido', destinatarioTipo: 'PJ',
})
assert(Math.abs(s4.economiaAbsoluta) < 0.01, 'Mesma UF → economia ~0')

let simT = false
try { simularTributacao({ origemUF: 'MT', destinoUF: 'SP', cultura: 'soja', valorTotal: 0, regime: 'lucro_real', destinatarioTipo: 'PJ' }) } catch { simT = true }
assert(simT, 'Simulador rejeita valor 0')

console.log(`\nResultado: ${pass} passou, ${fail} falhou`)
process.exit(fail > 0 ? 1 : 0)
