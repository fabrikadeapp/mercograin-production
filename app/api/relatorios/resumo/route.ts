/**
 * GET /api/relatorios/resumo
 * Consolida KPIs, receita por mês, top clientes, origem por UF, canal de venda
 * e (mock) eficiência logística para a tela /relatorios.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const whereOwn: any = scope.whereOwn()
    const whereCliente: any = scope.whereOwn()

    const now = new Date()
    const ytdStart = new Date(now.getFullYear(), 0, 1)
    const prevYtdStart = new Date(now.getFullYear() - 1, 0, 1)
    const prevYtdEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    const [
      propostasYtd,
      propostasPrevYtd,
      contratosYtd,
      boletos,
      clientesAll,
    ] = await Promise.all([
      db.proposta.findMany({
        where: {
          ...whereOwn,
          status: 'aceita',
          criadaEm: { gte: ytdStart },
        },
        select: {
          graos: true,
          valorTotal: true,
          criadaEm: true,
          cliente: { select: { id: true, nome: true, endereco: true } },
        },
      }),
      db.proposta.aggregate({
        where: {
          ...whereOwn,
          status: 'aceita',
          criadaEm: { gte: prevYtdStart, lte: prevYtdEnd },
        },
        _sum: { valorTotal: true },
      }),
      db.contrato.count({
        where: { ...whereOwn, criadoEm: { gte: ytdStart } },
      }),
      db.boleto.findMany({
        where: whereOwn,
        select: { valor: true, status: true, vencimento: true },
      }),
      db.cliente.findMany({
        where: whereCliente,
        select: { id: true, nome: true, endereco: true },
      }),
    ])

    // Receita bruta YTD
    const receitaYtd = propostasYtd.reduce((s, p) => s + Number(p.valorTotal), 0)
    const receitaPrev = Number(propostasPrevYtd._sum.valorTotal || 0)
    const deltaReceita = receitaPrev > 0 ? ((receitaYtd - receitaPrev) / receitaPrev) * 100 : 0

    // Tonelagem total + composição (sacas → toneladas, 1sc=60kg → 0.06t)
    const graoMap: Record<string, { qtd: number; valor: number }> = {
      soja: { qtd: 0, valor: 0 },
      milho: { qtd: 0, valor: 0 },
      trigo: { qtd: 0, valor: 0 },
    }
    let qtdTotal = 0
    for (const p of propostasYtd) {
      const arr = Array.isArray(p.graos) ? (p.graos as any[]) : []
      for (const g of arr) {
        const grao = String(g?.grao || '').toLowerCase()
        const qtd = Number(g?.quantidade || 0)
        const sub = Number(g?.subtotal || 0)
        qtdTotal += qtd
        if (graoMap[grao]) {
          graoMap[grao].qtd += qtd
          graoMap[grao].valor += sub
        }
      }
    }
    const tonsTotal = qtdTotal * 0.06
    const composicao = qtdTotal > 0
      ? {
          soja: Math.round((graoMap.soja.qtd / qtdTotal) * 100),
          milho: Math.round((graoMap.milho.qtd / qtdTotal) * 100),
          trigo: Math.round((graoMap.trigo.qtd / qtdTotal) * 100),
        }
      : { soja: 0, milho: 0, trigo: 0 }

    // Margem média (proxy): valor médio/saca normalizado
    const margemMedia = qtdTotal > 0 ? (receitaYtd / qtdTotal) * 0.1 : 0 // proxy %

    // Inadimplência
    const totalBoletos = boletos.length || 1
    const vencidos = boletos.filter((b) => b.status === 'vencido').length
    const inadimplPct = (vencidos / totalBoletos) * 100

    // 12 meses receita stacked por grão
    const meses: { label: string; soja: number; milho: number; trigo: number; value: number }[] = []
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const filtered = propostasYtd.filter((p) => p.criadaEm >= d && p.criadaEm < next)
      let s = 0, mi = 0, tr = 0
      for (const p of filtered) {
        const arr = Array.isArray(p.graos) ? (p.graos as any[]) : []
        for (const g of arr) {
          const v = Number(g?.subtotal || 0)
          if (g?.grao === 'soja') s += v
          else if (g?.grao === 'milho') mi += v
          else if (g?.grao === 'trigo') tr += v
        }
      }
      const total = (s + mi + tr) / 1_000_000
      meses.push({ label: MESES_PT[d.getMonth()], soja: s, milho: mi, trigo: tr, value: Math.round(total * 10) / 10 })
    }

    // Top clientes YTD
    const clienteAcc: Record<string, { nome: string; valor: number }> = {}
    for (const p of propostasYtd) {
      const id = p.cliente.id
      if (!clienteAcc[id]) clienteAcc[id] = { nome: p.cliente.nome, valor: 0 }
      clienteAcc[id].valor += Number(p.valorTotal)
    }
    const topArr = Object.values(clienteAcc).sort((a, b) => b.valor - a.valor).slice(0, 7)
    const maxValor = topArr[0]?.valor || 1
    const topClientes = topArr.map((c) => ({
      name: c.nome,
      pct: Math.round((c.valor / maxValor) * 100),
      value:
        c.valor >= 1_000_000
          ? `R$ ${(c.valor / 1_000_000).toFixed(1).replace('.', ',')}M`
          : `R$ ${(c.valor / 1_000).toFixed(0)}k`,
      color: c.valor / maxValor > 0.4 ? 'var(--accent)' : 'var(--warn)',
    }))

    // Origem dos grãos (distribuição por UF — extraída do endereço do cliente, heurística)
    const ufRegex = /\b([A-Z]{2})\b/
    const ufAcc: Record<string, number> = {}
    for (const c of clientesAll) {
      const m = c.endereco?.match(ufRegex)
      if (m) ufAcc[m[1]] = (ufAcc[m[1]] || 0) + 1
    }
    const totalUf = Object.values(ufAcc).reduce((s, n) => s + n, 0) || 1
    const origemGraos = Object.entries(ufAcc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uf, count], idx) => ({
        label: `${uf} — ${ufNome(uf)}`,
        pct: Math.round((count / totalUf) * 100),
        color: ['var(--grain-soja)', 'var(--grain-milho)', 'color-mix(in srgb, var(--grain-soja) 70%, var(--bg-3))', 'var(--grain-trigo)', 'var(--info)'][idx],
      }))

    // Canal de venda — derivado de Proposta.canalAutorizacao
    const canalCounts = await db.proposta.groupBy({
      by: ['canalAutorizacao'],
      where: { workspaceId: scope.workspaceId, status: { in: ['aceita', 'enviada'] } },
      _count: true,
    })
    const totalCanal = canalCounts.reduce((acc, c) => acc + c._count, 0) || 1
    const canalLabels: Record<string, string> = {
      web: 'Mesa direta',
      whatsapp: 'WhatsApp (Laura.IA)',
      telefone: 'Telefone (Laura.IA)',
      ia_autonomo: 'IA autônoma',
    }
    const canalColors: Record<string, string> = {
      web: 'var(--accent)',
      whatsapp: '#25D366',
      telefone: 'var(--info)',
      ia_autonomo: 'var(--warning)',
    }
    const canalVenda =
      canalCounts.length > 0
        ? canalCounts.map((c) => ({
            label: canalLabels[c.canalAutorizacao ?? 'web'] ?? c.canalAutorizacao ?? '—',
            pct: Math.round((c._count / totalCanal) * 100),
            color: canalColors[c.canalAutorizacao ?? 'web'] ?? 'var(--text-dim)',
          }))
        : [{ label: 'Mesa direta', pct: 100, color: 'var(--accent)' }]

    // Eficiência logística — sem dado real ainda, retorna comingSoon
    const logistica = {
      custoMedioT: null,
      leadTime: null,
      ocupacaoArmazem: null,
      quebraContratual: null,
      slaEntrega: null,
      nps: null as string | null,
      npsLabel: 'NPS pendente',
      comingSoon: true,
    }

    // KPIs
    const kpis = [
      {
        eyebrow: 'RECEITA BRUTA',
        delta: { value: `${deltaReceita >= 0 ? '+' : ''}${deltaReceita.toFixed(1)}%`, trend: deltaReceita >= 0 ? 'pos' : 'neg' },
        value: `R$ ${(receitaYtd / 1_000_000).toFixed(1).replace('.', ',')}M`,
        subtitle: `vs R$ ${(receitaPrev / 1_000_000).toFixed(1).replace('.', ',')}M ano anterior`,
      },
      {
        eyebrow: 'MARGEM MÉDIA',
        delta: { value: '+0,0%', trend: 'pos' as const },
        value: `${margemMedia.toFixed(1).replace('.', ',')}%`,
        subtitle: 'meta da safra 8,5%',
      },
      {
        eyebrow: 'TONELAGEM TOTAL',
        delta: { value: '+0,0%', trend: 'pos' as const },
        value: `${(tonsTotal / 1000).toFixed(0)}k t`,
        subtitle: `${composicao.soja}% soja · ${composicao.milho}% milho · ${composicao.trigo}% trigo`,
      },
      {
        eyebrow: 'TAXA DE INADIMPL.',
        delta: { value: `${inadimplPct.toFixed(2)}%`, trend: 'pos' as const },
        value: `${inadimplPct.toFixed(2).replace('.', ',')}%`,
        subtitle: 'benchmark setor 1,5%',
      },
    ]

    return NextResponse.json({
      kpis,
      receita12meses: meses,
      topClientes,
      origemGraos,
      canalVenda,
      logistica,
      contratosYtd,
      empty: propostasYtd.length === 0,
    })
  } catch (e: any) {
    console.error('GET /relatorios/resumo error:', e)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}

function ufNome(uf: string): string {
  const m: Record<string, string> = {
    MT: 'Mato Grosso', PR: 'Paraná', GO: 'Goiás', RS: 'Rio Grande', MS: 'M. Sul',
    SP: 'São Paulo', MG: 'Minas Gerais', BA: 'Bahia', SC: 'Santa Catarina',
  }
  return m[uf] || uf
}
