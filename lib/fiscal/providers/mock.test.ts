/**
 * Tests para MockProvider.
 * Run: npx tsx lib/fiscal/providers/mock.test.ts
 */
import { MockProvider, gerarChaveAcesso } from './mock'
import type { NFeEmissaoPayload } from './types'

let pass = 0, fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const baseline: NFeEmissaoPayload = {
  tipo: 'saida',
  modelo: '55',
  serie: 1,
  numero: 42,
  naturezaOperacao: 'Venda de soja',
  finalidadeEmissao: '1',
  ambiente: 'homologacao',
  emitente: {
    cnpj: '12345678000199',
    nome: 'CORRETORA RS',
    uf: 'RS',
    regimeTributario: 'lucro_presumido',
    inscricaoEstadual: '0900012345',
  },
  destinatario: {
    doc: '98765432000111',
    nome: 'INDUSTRIA SC',
    uf: 'SC',
  },
  itens: [
    {
      descricao: 'Soja em grão',
      ncm: '12019000',
      cfop: '6101',
      qtd: 1000,
      unidade: 'SC',
      valorUnitario: 130,
      valorTotal: 130000,
    },
  ],
  totais: {
    valorProdutos: 130000,
    valorICMS: 9100,
    valorPIS: 0,
    valorCOFINS: 0,
    valorFrete: 0,
    valorOutros: 0,
    valorTotal: 139100,
  },
}

;(async () => {
  const p = new MockProvider()

  console.log('\n== Chave de acesso ==')
  {
    const chave = gerarChaveAcesso(baseline)
    assert(chave.length === 44, `Chave tem 44 dígitos (got ${chave.length})`)
    assert(/^\d{44}$/.test(chave), 'Chave só dígitos')
    assert(chave.startsWith('43'), 'cUF RS = 43')
  }

  console.log('\n== Emitir NF-e válida ==')
  {
    const r = await p.emitirNFe(baseline)
    assert(r.ok, 'ok=true')
    assert(r.status === 'autorizada', `status autorizada (got ${r.status})`)
    assert(!!r.chave && r.chave.length === 44, 'Chave 44 retornada')
    assert(!!r.protocolo, 'Protocolo presente')
    assert(!!r.xmlUrl && !!r.danfeUrl, 'URLs presentes')
  }

  console.log('\n== Emitir com CNPJ inválido — rejeita ==')
  {
    const r = await p.emitirNFe({ ...baseline, emitente: { ...baseline.emitente, cnpj: '123' } })
    assert(!r.ok, 'ok=false')
    assert(r.status === 'rejeitada', 'status rejeitada')
    assert(!!r.motivoRejeicao, 'Motivo presente')
  }

  console.log('\n== Cancelar com motivo curto rejeita ==')
  {
    const r = await p.cancelarNFe('43xxx', 'curto')
    assert(!r.ok, 'Rejeitado motivo < 15 chars')
  }

  console.log('\n== Cancelar com motivo válido aceita ==')
  {
    const r = await p.cancelarNFe('43xxx', 'Erro no preenchimento do destinatario')
    assert(r.ok, 'Aceito')
    assert(!!r.protocolo, 'Protocolo de cancelamento')
  }

  console.log('\n== Carta correção valida texto ==')
  {
    const r1 = await p.enviarCartaCorrecao('43xx', 'curto', 1)
    assert(!r1.ok, 'Rejeita texto curto')
    const r2 = await p.enviarCartaCorrecao('43xx', 'Correcao do CFOP do item 1 da nota', 1)
    assert(r2.ok, 'Aceita texto válido')
  }

  console.log('\n== Testar conexão mock ==')
  {
    const r = await p.testarConexao()
    assert(r.ok, 'Mock sempre OK')
  }

  console.log(`\nResultado: ${pass} PASS / ${fail} FAIL`)
  if (fail > 0) process.exit(1)
})()
