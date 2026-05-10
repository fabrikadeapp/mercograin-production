/**
 * Tests para parser-xml-fiscal.
 * Run: npx tsx lib/br/parser-xml-fiscal.test.ts
 */
import assert from 'node:assert/strict'
import {
  parseNFeXml,
  parseCTeXml,
  parseMDFeXml,
  detectXmlKind,
} from './parser-xml-fiscal'

function dvChaveAcesso(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  for (let i = 0; i < chave43.length; i++) {
    const d = parseInt(chave43[chave43.length - 1 - i], 10)
    soma += d * pesos[i % pesos.length]
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return String(dv)
}

const chaveNFe = (() => {
  const b = '43' + '2510' + '00000000000191' + '55' + '001' + '000000123' + '1' + '12345678'
  return b + dvChaveAcesso(b)
})()
const chaveCTe = (() => {
  const b = '41' + '2603' + '12345678000195' + '57' + '001' + '000000777' + '1' + '87654321'
  return b + dvChaveAcesso(b)
})()
const chaveMDFe = (() => {
  const b = '51' + '2604' + '11222333000181' + '58' + '001' + '000001234' + '1' + '99887766'
  return b + dvChaveAcesso(b)
})()

const xmlNFe = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe${chaveNFe}" versao="4.00">
      <ide><mod>55</mod><serie>1</serie><nNF>123</nNF><dhEmi>2026-04-01T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>00000000000191</CNPJ><xNome>BH Grain LTDA</xNome></emit>
      <dest><CNPJ>99888777000166</CNPJ><xNome>Cliente Teste S.A.</xNome></dest>
      <det nItem="1">
        <prod>
          <xProd>SOJA EM GRAO</xProd><NCM>12019000</NCM><CFOP>5101</CFOP>
          <uCom>KG</uCom><qCom>30000.00</qCom><vUnCom>1.85</vUnCom><vProd>55500.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>55500.00</vNF><vProd>55500.00</vProd></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`

const xmlCTe = `<?xml version="1.0"?>
<cteProc>
  <CTe>
    <infCte Id="CTe${chaveCTe}" versao="4.00">
      <ide><mod>57</mod><serie>1</serie><nCT>777</nCT><dhEmi>2026-03-15T09:00:00-03:00</dhEmi><UFIni>PR</UFIni><UFFim>RS</UFFim></ide>
      <emit><CNPJ>12345678000195</CNPJ><xNome>Transportadora ABC</xNome></emit>
      <rem><CNPJ>00000000000191</CNPJ></rem>
      <dest><CNPJ>99888777000166</CNPJ></dest>
      <vPrest><vTPrest>2500.00</vTPrest></vPrest>
      <infCarga><vCarga>55500.00</vCarga></infCarga>
    </infCte>
  </CTe>
</cteProc>`

const xmlMDFe = `<?xml version="1.0"?>
<mdfeProc>
  <MDFe>
    <infMDFe Id="MDFe${chaveMDFe}" versao="3.00">
      <ide><mod>58</mod><serie>1</serie><nMDF>1234</nMDF><dhEmi>2026-04-02T08:00:00-03:00</dhEmi><UFIni>MT</UFIni><UFFim>PR</UFFim></ide>
      <emit><CNPJ>11222333000181</CNPJ><xNome>Transportadora XYZ</xNome></emit>
      <veicTracao><placa>ABC1D23</placa></veicTracao>
      <tot><qCTe>3</qCTe><qNFe>5</qNFe><vCarga>180000.00</vCarga><qCarga>32.500</qCarga></tot>
    </infMDFe>
  </MDFe>
</mdfeProc>`

let n = 0
function test(name: string, fn: () => void) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

console.log('parser-xml-fiscal.test.ts')

test('1. detectXmlKind reconhece tipos', () => {
  assert.equal(detectXmlKind(xmlNFe), 'nfe')
  assert.equal(detectXmlKind(xmlCTe), 'cte')
  assert.equal(detectXmlKind(xmlMDFe), 'mdfe')
  assert.equal(detectXmlKind('<foo/>'), 'unknown')
})

test('2. parseNFeXml extrai campos principais', () => {
  const r = parseNFeXml(xmlNFe)
  assert.ok(r)
  assert.equal(r!.chave, chaveNFe)
  assert.equal(r!.numero, '123')
  assert.equal(r!.modelo, '55')
  assert.equal(r!.emitenteCnpj, '00000000000191')
  assert.equal(r!.destinatarioDoc, '99888777000166')
  assert.equal(r!.valor, 55500)
  assert.equal(r!.itens.length, 1)
  assert.equal(r!.itens[0].ncm, '12019000')
  assert.equal(r!.itens[0].cfop, '5101')
  assert.equal(r!.itens[0].qtd, 30000)
})

test('3. parseCTeXml extrai chave, UF origem/destino e valor', () => {
  const r = parseCTeXml(xmlCTe)
  assert.ok(r)
  assert.equal(r!.chave, chaveCTe)
  assert.equal(r!.modelo, '57')
  assert.equal(r!.origemUF, 'PR')
  assert.equal(r!.destinoUF, 'RS')
  assert.equal(r!.valorTotal, 2500)
  assert.equal(r!.valorCarga, 55500)
})

test('4. parseMDFeXml extrai placa, totais e UFs', () => {
  const r = parseMDFeXml(xmlMDFe)
  assert.ok(r)
  assert.equal(r!.chave, chaveMDFe)
  assert.equal(r!.modelo, '58')
  assert.equal(r!.ufIni, 'MT')
  assert.equal(r!.ufFim, 'PR')
  assert.equal(r!.qtdCTe, 3)
  assert.equal(r!.qtdNFe, 5)
  assert.equal(r!.placaVeic, 'ABC1D23')
  // qCarga em toneladas → kg
  assert.equal(r!.pesoBrutoKg, 32500)
})

test('5. parsers retornam null pra XML inválido/chave inválida', () => {
  assert.equal(parseNFeXml(''), null)
  assert.equal(parseCTeXml('<foo/>'), null)
  assert.equal(parseMDFeXml('lixo'), null)
})

console.log(`  ${n} tests passed`)
