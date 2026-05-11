/**
 * E2E: propriedade com CAR -> talhão -> lote -> DDS -> render PDF -> hash imutável.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { uid, makeStore, sha256, audit } = require('./_helpers')

const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId })

let propId, talhaoId, loteId, ddsId

test('cria propriedade com CAR', () => {
  propId = uid('prop')
  store.propriedades.set(propId, {
    id: propId, workspaceId: wsId,
    nome: 'Faz. São João', car: 'MT-5103403-A1B2',
    latitude: -12.5, longitude: -55.7,
  })
  assert.ok(store.propriedades.has(propId))
})

test('cria talhão', () => {
  talhaoId = uid('tlh')
  store.talhoes.set(talhaoId, {
    id: talhaoId, propriedadeId: propId, workspaceId: wsId,
    codigo: 'T-01', areaHa: 150.5, geomGeoJSON: { type: 'Polygon', coordinates: [[]] },
  })
  assert.ok(store.talhoes.has(talhaoId))
})

test('cria lote ligado ao talhão (cadeia custódia)', () => {
  loteId = uid('lot')
  store.lotes.set(loteId, {
    id: loteId, talhaoId, workspaceId: wsId,
    grao: 'soja', safra: '2025/26',
    quantidadeKg: 60000, produzidoEm: '2026-03-15',
  })
  assert.ok(store.lotes.has(loteId))
})

test('gera DDS amarrando lote -> talhão -> propriedade -> CAR', () => {
  ddsId = uid('dds')
  const lote = store.lotes.get(loteId)
  const talhao = store.talhoes.get(lote.talhaoId)
  const prop = store.propriedades.get(talhao.propriedadeId)
  const dds = {
    id: ddsId, workspaceId: wsId, loteId,
    car: prop.car, geo: { lat: prop.latitude, lng: prop.longitude },
    sobreposicaoAreasProtegidas: false,
    listaSuja: false,
    geradoEm: '2026-05-10',
  }
  store.dds.set(ddsId, dds)
  assert.equal(dds.car, 'MT-5103403-A1B2')
  audit(store, 'dds.gerada', { ddsId, loteId })
})

test('renderiza PDF (mock) e calcula hash imutável', () => {
  const dds = store.dds.get(ddsId)
  const pdfBytes = Buffer.from(JSON.stringify(dds))
  dds.pdfHash = sha256(pdfBytes)
  assert.equal(dds.pdfHash.length, 64)
})

test('hash não muda quando re-renderiza com mesmo input', () => {
  const dds = store.dds.get(ddsId)
  const again = sha256(Buffer.from(JSON.stringify({
    id: dds.id, workspaceId: dds.workspaceId, loteId: dds.loteId,
    car: dds.car, geo: dds.geo,
    sobreposicaoAreasProtegidas: dds.sobreposicaoAreasProtegidas,
    listaSuja: dds.listaSuja, geradoEm: dds.geradoEm,
  })))
  assert.equal(again, dds.pdfHash)
})
