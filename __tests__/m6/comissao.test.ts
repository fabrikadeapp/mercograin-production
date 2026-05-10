/* eslint-disable */
import {
  aplicaRegraEm,
  selecionarRegra,
  distribuirComissao,
} from '../../lib/comissao/calcular'

let pass = 0,
  fail = 0
function t(name, fn) {
  try {
    fn()
    console.log('  PASS', name)
    pass++
  } catch (e) {
    console.log('  FAIL', name, '-', e.message)
    fail++
  }
}
function eq(a, b, m) {
  if (a !== b) throw new Error(`${m}: ${a} !== ${b}`)
}
function close(a, b, m, eps = 0.01) {
  if (Math.abs(a - b) > eps) throw new Error(`${m}: ${a} ~ ${b}`)
}
function tru(c, m) {
  if (!c) throw new Error(m)
}

console.log('COMISSAO tests:')

const REGRA_BASE = {
  id: 'r1',
  pctTotal: 2,
  pctCorretor: 0.8,
  pctOriginador: 0.3,
  pctMesa: 0.4,
  pctHouse: 0.5,
  ativo: true,
  prioridade: 0,
}

// 1: aplicaRegraEm global true
t('aplicaRegraEm global true', () => {
  tru(aplicaRegraEm({ ...REGRA_BASE, escopoTipo: 'global' }, {}), 'global')
})

// 2: aplicaRegraEm cultura match
t('aplicaRegraEm cultura match', () => {
  tru(
    aplicaRegraEm(
      { ...REGRA_BASE, escopoTipo: 'cultura', escopoFiltro: { cultura: 'soja' } },
      { cultura: 'soja' }
    ),
    'soja'
  )
})

// 3: aplicaRegraEm cultura no match
t('aplicaRegraEm cultura no match', () => {
  tru(
    !aplicaRegraEm(
      { ...REGRA_BASE, escopoTipo: 'cultura', escopoFiltro: { cultura: 'soja' } },
      { cultura: 'milho' }
    ),
    'no match'
  )
})

// 4: distribuirComissao soma == pctTotal
t('distribuirComissao soma == pctTotal', () => {
  const d = distribuirComissao(REGRA_BASE, 100000)
  eq(d.valorTotal, 2000, 'total')
  eq(d.corretor, 800, 'corretor')
  eq(d.originador, 300, 'originador')
  eq(d.mesa, 400, 'mesa')
  eq(d.house, 500, 'house')
})

// 5: distribuirComissao soma excede → normaliza
t('distribuirComissao normaliza quando partes > pctTotal', () => {
  const r = { ...REGRA_BASE, pctTotal: 1, pctCorretor: 0.8, pctOriginador: 0.5, pctMesa: 0.5, pctHouse: 0.2 }
  const d = distribuirComissao(r, 100000)
  eq(d.valorTotal, 1000, 'total 1%')
  close(d.corretor + d.originador + d.mesa + d.house, 1000, 'soma ~ total')
})

// 6: distribuirComissao sem distribuição → tudo house
t('distribuirComissao sem distribuição → tudo house', () => {
  const r = { ...REGRA_BASE, pctCorretor: 0, pctOriginador: 0, pctMesa: 0, pctHouse: 0 }
  const d = distribuirComissao(r, 50000)
  eq(d.house, 1000, 'house = total')
  eq(d.corretor, 0, 'corretor 0')
})

// 7: selecionarRegra maior prioridade
t('selecionarRegra maior prioridade', () => {
  const a = { ...REGRA_BASE, id: 'a', prioridade: 1 }
  const b = { ...REGRA_BASE, id: 'b', prioridade: 5 }
  const r = selecionarRegra([a, b], {})
  eq(r.id, 'b', 'b ganha')
})

// 8: selecionarRegra prefere específico vs global mesma prioridade
t('selecionarRegra prefere específico', () => {
  const g = { ...REGRA_BASE, id: 'g', escopoTipo: 'global', prioridade: 0 }
  const e = {
    ...REGRA_BASE,
    id: 'e',
    escopoTipo: 'cultura',
    escopoFiltro: { cultura: 'soja' },
    prioridade: 0,
  }
  const r = selecionarRegra([g, e], { cultura: 'soja' })
  eq(r.id, 'e', 'específica ganha')
})

console.log(`\nCOMISSAO results: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
