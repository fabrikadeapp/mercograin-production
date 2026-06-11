/**
 * Tests para lib/quotes/focus-client.ts
 * Run: npx tsx lib/quotes/focus-client.test.ts
 */
import { buildUrl, dedupCurva, type FocusPonto } from './focus-client'

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

function ponto(p: Partial<FocusPonto>): FocusPonto {
  return {
    indicador: 'Câmbio',
    dataColeta: '2026-06-01',
    mesReferencia: '07/2026',
    media: 5.0,
    mediana: 5.0,
    minimo: 4.5,
    maximo: 5.5,
    desvioPadrao: 0.1,
    respondentes: 30,
    ...p,
  }
}

// ── buildUrl: encode do filtro (acento da Ç e espaços) ──────────────────────
{
  const url = buildUrl('Câmbio', 200)
  assert(url.includes('$top=200'), 'buildUrl inclui $top', url)
  assert(url.includes('$format=json'), 'buildUrl inclui $format=json', url)
  // encodeURIComponent: â = %C3%A2, espaço = %20. A aspa simples NÃO é encodada
  // (caractere válido na query string), permanece literal.
  assert(
    url.includes("$filter=Indicador%20eq%20'C%C3%A2mbio'"),
    'buildUrl encoda o filtro (espaços e Ç)',
    url,
  )
  // garante que o â cru NÃO aparece (precisa estar encodado)
  assert(!url.includes("'Câmbio'"), 'buildUrl não deixa o acento cru no filtro', url)
  assert(url.includes('orderby'), 'buildUrl inclui orderby (Data desc)', url)
}

// ── dedupCurva: 1 ponto por mês = coleta mais recente, ordem cronológica ─────
{
  const pontos: FocusPonto[] = [
    // 07/2026 com duas coletas — deve vencer a de 2026-06-01 (mais recente)
    ponto({ mesReferencia: '07/2026', dataColeta: '2026-05-01', mediana: 5.1 }),
    ponto({ mesReferencia: '07/2026', dataColeta: '2026-06-01', mediana: 5.3 }),
    // 12/2026
    ponto({ mesReferencia: '12/2026', dataColeta: '2026-06-01', mediana: 5.6 }),
    // 01/2027 (ano seguinte — deve vir depois de 12/2026)
    ponto({ mesReferencia: '01/2027', dataColeta: '2026-06-01', mediana: 5.7 }),
    // 03/2026 (passado — deve vir primeiro na ordem)
    ponto({ mesReferencia: '03/2026', dataColeta: '2026-06-01', mediana: 4.9 }),
  ]
  const curva = dedupCurva(pontos)

  assert(curva.length === 4, 'dedup colapsa 5 pontos em 4 meses únicos', `${curva.length}`)

  const jul = curva.find((p) => p.mesReferencia === '07/2026')!
  assert(
    jul.dataColeta === '2026-06-01' && jul.mediana === 5.3,
    'dedup mantém a coleta MAIS RECENTE de 07/2026',
    JSON.stringify(jul),
  )

  const ordem = curva.map((p) => p.mesReferencia)
  assert(
    JSON.stringify(ordem) === JSON.stringify(['03/2026', '07/2026', '12/2026', '01/2027']),
    'dedup ordena por mesReferencia ASC (cronológico, com virada de ano)',
    JSON.stringify(ordem),
  )
}

// ── dedupCurva: ignora pontos sem mesReferencia ─────────────────────────────
{
  const pontos: FocusPonto[] = [
    ponto({ mesReferencia: '', dataColeta: '2026-06-01' }),
    ponto({ mesReferencia: '08/2026', dataColeta: '2026-06-01' }),
  ]
  const curva = dedupCurva(pontos)
  assert(curva.length === 1 && curva[0].mesReferencia === '08/2026', 'dedup ignora mesReferencia vazio', JSON.stringify(curva))
}

// ── dedupCurva: lista vazia ─────────────────────────────────────────────────
{
  assert(dedupCurva([]).length === 0, 'dedup de lista vazia retorna []')
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
