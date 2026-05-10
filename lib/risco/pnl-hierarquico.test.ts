/**
 * Smoke tests para lib/risco/pnl-hierarquico — valida agregação básica
 * sem tocar no banco. Stubs db via Proxy.
 * Run: npx tsx lib/risco/pnl-hierarquico.test.ts
 */

let pass = 0
let fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('pnl-hierarquico.test.ts')

// Mock @/lib/db via require cache
const mockData = {
  posicoes: [
    { id: 'p1', mesaId: 'm1', corretorId: 'c1', contratoOrigemId: 'co1', status: 'aberta', pnlFinalUSD: null, pnlFinalBRL: null, marcacoes: [{ pnlUnrealizedUSD: 1000, pnlUnrealizedBRL: 5000 }] },
    { id: 'p2', mesaId: 'm1', corretorId: 'c2', contratoOrigemId: null, status: 'fechada', pnlFinalUSD: 2000, pnlFinalBRL: 10000, marcacoes: [] },
    { id: 'p3', mesaId: null, corretorId: 'c1', contratoOrigemId: 'co1', status: 'aberta', pnlFinalUSD: null, pnlFinalBRL: null, marcacoes: [{ pnlUnrealizedUSD: -500, pnlUnrealizedBRL: -2500 }] },
  ],
  mesas: [{ id: 'm1', nome: 'Mesa Norte', comissaoPct: 0.5 }],
  corretores: [
    { id: 'c1', nome: 'Alice', comissaoPct: 1.0 },
    { id: 'c2', nome: 'Bob', comissaoPct: 0.5 },
  ],
  contratos: [{ id: 'co1', numero: 'CT-001' }],
}

const Module = require('module')
const origResolve = Module._resolve_filename || Module._resolveFilename
const origLoad = Module._load

Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === '@/lib/db' || request.endsWith('/lib/db') || request === '../db') {
    return {
      db: {
        posicaoHedge: { findMany: async () => mockData.posicoes },
        mesa: { findMany: async () => mockData.mesas },
        corretor: { findMany: async () => mockData.corretores },
        contrato: { findMany: async () => mockData.contratos },
      },
    }
  }
  return origLoad.call(this, request, parent, isMain)
}

;(async () => {
  const mod = require('./pnl-hierarquico')
  const wsId = 'ws-test'

  // Test 1: por mesa — Mesa Norte agrega p1 (1000) + p2 (2000) = 3000 USD
  {
    const r = await mod.calcularPnLPorMesa(wsId)
    const mesaNorte = r.find((x: any) => x.chave === 'm1')
    assert(!!mesaNorte, 'mesa Norte presente')
    assert(mesaNorte.pnlUSD === 3000, `mesa Norte pnlUSD = 3000`, `got ${mesaNorte.pnlUSD}`)
    const semMesa = r.find((x: any) => x.chave === '_sem_mesa')
    assert(!!semMesa && semMesa.pnlUSD === -500, 'sem mesa = -500', `got ${semMesa?.pnlUSD}`)
  }

  // Test 2: por corretor — Alice tem p1 (1000) + p3 (-500) = 500
  {
    const r = await mod.calcularPnLPorCorretor(wsId)
    const alice = r.find((x: any) => x.chave === 'c1')
    assert(alice && alice.pnlUSD === 500, 'Alice pnlUSD = 500', `got ${alice?.pnlUSD}`)
    const bob = r.find((x: any) => x.chave === 'c2')
    assert(bob && bob.pnlUSD === 2000, 'Bob pnlUSD = 2000', `got ${bob?.pnlUSD}`)
  }

  // Test 3: por contrato — CT-001 tem p1 (1000) + p3 (-500) = 500
  {
    const r = await mod.calcularPnLPorContrato(wsId)
    const ct = r.find((x: any) => x.chave === 'co1')
    assert(ct && ct.pnlUSD === 500, 'CT-001 pnlUSD = 500', `got ${ct?.pnlUSD}`)
  }

  // Test 4: ranking corretores — Bob (2000) > Alice (500)
  {
    const r = await mod.calcularRankingCorretores(wsId)
    assert(r.length === 2, 'ranking 2 corretores', `got ${r.length}`)
    assert(r[0].chave === 'c2' && r[0].rank === 1, 'Bob rank 1', `got ${r[0]?.chave}`)
    assert(r[1].chave === 'c1' && r[1].rank === 2, 'Alice rank 2', `got ${r[1]?.chave}`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
})().catch((e) => { console.error(e); process.exit(1) })
