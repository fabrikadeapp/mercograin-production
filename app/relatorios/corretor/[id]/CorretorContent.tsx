'use client'
import * as React from 'react'
import { Card, CardHeader, CardTitle, KPICard, Skeleton, ErrorBanner } from '@/components/ui/phb'

interface Resp {
  nome: string
  contratosFechados: number
  valorTotal: number
  propostasEnviadas: number
  propostasAceitas: number
  hitRate: number
  tempoMedioFechamento: number
  comissaoAcumulada: number
  rankingPosicao: number | null
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

export function CorretorContent({ corretorId }: { corretorId: string }) {
  const [data, setData] = React.useState<Resp | null>(null)
  const [ranking, setRanking] = React.useState<any[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/bi/corretor/${corretorId}`, { cache: 'no-store' }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      }),
      fetch('/api/bi/ranking-corretores?top=10', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { items: [] }),
    ])
      .then(([k, r]) => { setData(k); setRanking(r.items || []) })
      .catch((e) => setErr(String(e.message || e)))
  }, [corretorId])

  if (err) return <ErrorBanner message={err} />
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={120} />)}
      </div>
    )
  }

  const kpis = [
    { eyebrow: 'CONTRATOS', value: String(data.contratosFechados), subtitle: 'fechados no período' },
    { eyebrow: 'VALOR TOTAL', value: fmtBRL(data.valorTotal) },
    { eyebrow: 'HIT RATE', value: `${data.hitRate.toFixed(1).replace('.', ',')}%`, subtitle: `${data.propostasAceitas}/${data.propostasEnviadas}` },
    { eyebrow: 'TEMPO MÉDIO', value: `${data.tempoMedioFechamento.toFixed(1).replace('.', ',')} dias`, subtitle: 'proposta → contrato' },
    { eyebrow: 'COMISSÃO', value: fmtBRL(data.comissaoAcumulada) },
    { eyebrow: 'RANKING', value: data.rankingPosicao ? `#${data.rankingPosicao}` : '—', subtitle: 'posição no workspace' },
  ]

  return (
    <div className="space-y-6">
      <p className="text-fg-2">Corretor: <span className="text-fg-1 font-medium">{data.nome}</span></p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kp) => <KPICard key={kp.eyebrow} {...kp} />)}
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle eyebrow="RANKING">Top corretores · período</CardTitle>
        </CardHeader>
        {!ranking || ranking.length === 0 ? (
          <p className="text-fg-3 text-small">Sem corretores no ranking ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="text-fg-3 text-left eyebrow">
                <tr>
                  <th className="py-2">#</th><th>Nome</th>
                  <th className="text-right">Contratos</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.corretorId} className={r.corretorId === corretorId ? 'text-accent' : 'text-fg-1'}>
                    <td className="py-2">{i + 1}</td>
                    <td>{r.nome}</td>
                    <td className="text-right t-num">{r.contratosFechados}</td>
                    <td className="text-right t-num">{fmtBRL(r.valorTotal)}</td>
                    <td className="text-right t-num">{fmtBRL(r.comissaoAcumulada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
