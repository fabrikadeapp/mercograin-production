/**
 * Tests para lib/intel/agregador.ts
 * Run: npx tsx lib/intel/agregador.test.ts
 */
import {
  montarPanorama,
  classificarVies,
  sinalDaVariacao,
  calcularVariacao,
  viesGeral,
  LIMIAR_FLAT_PCT,
  type MontarPanoramaInput,
} from './agregador'

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

function approxEq(a: number, b: number, eps = 1e-4) {
  return Math.abs(a - b) < eps
}

const GERADO = '2026-06-11T00:00:00Z'

// ── 1) classificarVies: soma das contribuições ──────────────────────────────
{
  assert(classificarVies([1, 1, -1]) === 'altista', 'classificarVies soma +1 → altista')
  assert(classificarVies([-1, -1, 1]) === 'baixista', 'classificarVies soma -1 → baixista')
  assert(classificarVies([1, -1]) === 'neutro', 'classificarVies soma 0 → neutro')
  assert(classificarVies([]) === 'neutro', 'classificarVies vazio → neutro')
}

// ── 2) sinalDaVariacao: estoque sobe → baixista, export sobe → altista ───────
{
  // estoque (peso baixista) subindo → -1 (baixista)
  assert(sinalDaVariacao('up', 'baixista') === -1, 'estoque sobe → baixista (-1)')
  // estoque caindo → +1 (altista)
  assert(sinalDaVariacao('down', 'baixista') === 1, 'estoque cai → altista (+1)')
  // exportação (peso altista) subindo → +1 (altista)
  assert(sinalDaVariacao('up', 'altista') === 1, 'export sobe → altista (+1)')
  assert(sinalDaVariacao('down', 'altista') === -1, 'export cai → baixista (-1)')
  // flat → 0 em ambos
  assert(sinalDaVariacao('flat', 'altista') === 0, 'flat → neutro (0)')
}

// ── 3) calcularVariacao: up/down/flat/null ──────────────────────────────────
{
  const up = calcularVariacao(110, 100)
  assert(up.seta === 'up' && approxEq(up.pct!, 10), 'variação up +10%', JSON.stringify(up))
  const flat = calcularVariacao(100.02, 100)
  assert(flat.seta === 'flat', 'variação < limiar é flat', JSON.stringify(flat))
  const nulo = calcularVariacao(null, 100)
  assert(nulo.pct === null && nulo.seta === 'flat', 'atual null → null/flat', JSON.stringify(nulo))
  const zero = calcularVariacao(100, 0)
  assert(zero.pct === null && zero.seta === 'flat', 'base zero → null/flat', JSON.stringify(zero))
  assert(LIMIAR_FLAT_PCT === 0.05, 'LIMIAR_FLAT_PCT = 0,05', `${LIMIAR_FLAT_PCT}`)
}

// ── 4) montarPanorama: subconjunto de fontes; ausentes são omitidas ─────────
{
  const input: MontarPanoramaInput = {
    grao: 'soja',
    geradoEm: GERADO,
    ofertaDemanda: {
      referencia: 'Junho 2026',
      // estoque SUBINDO → sinal baixista
      estoqueFinal: { atual: 124.9, anterior: 120.0 },
    },
    // exportacoes, focus, conab, dolar* ausentes → omitidos
  }
  const p = montarPanorama(input)
  assert(p.grao === 'soja', 'grao preservado')
  assert(p.geradoEm === GERADO, 'geradoEm carimbado pelo caller (sem data do sistema)')
  assert(p.fontes.length === 1, 'só 1 fonte presente (USDA PSD)', `${p.fontes.length}`)
  assert(p.fontes[0].fonte === 'USDA PSD', 'fonte é USDA PSD', p.fontes[0].fonte)
  assert(p.fontes[0].titulo.includes('Junho 2026'), 'referência no título', p.fontes[0].titulo)
  const estoqueItem = p.fontes[0].itens.find((i) => i.rotulo === 'Estoques Finais')!
  assert(estoqueItem.seta === 'up', 'estoque seta up', estoqueItem.seta)
  // estoque subindo → sinal baixista
  assert(
    p.sinais.length === 1 && p.sinais[0].vies === 'baixista',
    'estoque subindo gera sinal baixista',
    JSON.stringify(p.sinais),
  )
}

// ── 5) montarPanorama: exportação forte → altista; dólar projetado sobe → altista ──
{
  const input: MontarPanoramaInput = {
    grao: 'milho',
    geradoEm: GERADO,
    exportacoes: {
      marketYear: 2026,
      vendasSemana: 1500,
      vendasSemanaAnterior: 900,
      acumulado: 32000,
      emCarteira: 5000,
    },
    focus: {
      cambio: { dataReferencia: '12/2026', mediana: 5.4, medianaAnterior: 5.1 },
      selic: { mediana: 10.5 },
    },
  }
  const p = montarPanorama(input)
  assert(p.fontes.length === 2, '2 fontes (ESR + Focus)', `${p.fontes.length}`)
  const esr = p.fontes.find((f) => f.fonte === 'USDA ESR')!
  assert(esr.itens.some((i) => i.rotulo === 'Acumulado (safra)'), 'ESR inclui acumulado')
  assert(esr.itens.some((i) => i.rotulo === 'Em carteira'), 'ESR inclui em carteira')
  // exportação subindo → altista; dólar projetado subindo → altista
  const altistas = p.sinais.filter((s) => s.vies === 'altista')
  assert(altistas.length === 2, 'export forte + dólar projetado em alta = 2 sinais altistas', JSON.stringify(p.sinais))
  assert(viesGeral(p) === 'altista', 'viés geral altista')
}

// ── 6) montarPanorama: CONAB safra maior → baixista; câmbio presente+futuro ──
{
  const input: MontarPanoramaInput = {
    grao: 'soja',
    geradoEm: GERADO,
    conab: {
      safra: '2025/26',
      producaoMt: 170.0,
      producaoMtAnterior: 160.0, // safra maior → baixista
      areaMilhaoHa: 47.5,
      produtividade: 3500,
    },
    dolarPresente: { valor: 5.0, anterior: 4.95, fonte: 'PTAX' },
    dolarFuturo: [
      { mesRef: '07/2026', mediana: 5.05 },
      { mesRef: '12/2026', mediana: 5.3 }, // curva subindo → altista p/ R$
    ],
  }
  const p = montarPanorama(input)
  const conabBloco = p.fontes.find((f) => f.fonte === 'CONAB')!
  assert(conabBloco !== undefined, 'bloco CONAB presente')
  assert(conabBloco.itens.some((i) => i.rotulo === 'Área plantada'), 'CONAB inclui área')
  const cambioBloco = p.fontes.find((f) => f.fonte === 'Câmbio')!
  assert(cambioBloco !== undefined, 'bloco Câmbio presente')
  assert(cambioBloco.itens.some((i) => i.rotulo === 'Dólar à vista'), 'câmbio inclui dólar à vista')
  assert(cambioBloco.itens.some((i) => i.rotulo.includes('Curva')), 'câmbio inclui ponto da curva')
  // safra maior → baixista; curva futura subindo → altista
  assert(p.sinais.some((s) => s.vies === 'baixista'), 'safra maior gera sinal baixista', JSON.stringify(p.sinais))
  assert(p.sinais.some((s) => s.vies === 'altista'), 'curva futura subindo gera sinal altista', JSON.stringify(p.sinais))
}

// ── 7) montarPanorama: input mínimo (nenhuma fonte) → fontes/sinais vazios ───
{
  const p = montarPanorama({ grao: 'milho', geradoEm: GERADO })
  assert(p.fontes.length === 0, 'sem fontes → array vazio', `${p.fontes.length}`)
  assert(p.sinais.length === 0, 'sem sinais → array vazio', `${p.sinais.length}`)
  assert(viesGeral(p) === 'neutro', 'viés geral neutro sem sinais')
  assert(p.geradoEm === GERADO, 'geradoEm preservado mesmo vazio')
}

// ── 8) montarPanorama: fonte com dados nulos não cria bloco vazio ───────────
{
  // dolarPresente com valor null e sem futuro → bloco câmbio omitido
  const p = montarPanorama({
    grao: 'soja',
    geradoEm: GERADO,
    dolarPresente: { valor: null },
    dolarFuturo: null,
  })
  assert(p.fontes.length === 0, 'dólar null + futuro null → bloco câmbio omitido', `${p.fontes.length}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
