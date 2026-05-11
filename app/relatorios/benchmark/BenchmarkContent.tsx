'use client'
import * as React from 'react'
import { Card, CardHeader, CardTitle, KPICard, Skeleton, ErrorBanner, Chip } from '@/components/ui/phb'

interface Resp {
  posicaoVolume: number | null
  posicaoComissao: number | null
  posicaoTicketMedio: number | null
  totalParticipantes: number
  percentilGlobal: number | null
  medianaComissao: number
  medianaTicketMedio: number
  medianaVolumeT: number
  destaque: { melhorComissao: number; melhorTicket: number; melhorVolume: number }
  habilitado: boolean
  motivo?: string
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

export function BenchmarkContent() {
  const [data, setData] = React.useState<Resp | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('/api/bi/benchmark', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  if (err) return <ErrorBanner message={err} />
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} />)}
      </div>
    )
  }

  const posStr = (p: number | null) => p ? `#${p}` : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Chip variant={data.habilitado ? 'pos' : 'neutral'}>
          {data.habilitado ? 'Benchmark ativo' : 'Benchmark indisponível'}
        </Chip>
        <span className="text-fg-3 text-small">
          {data.totalParticipantes} corretora(s) participando · dados anonimizados
        </span>
      </div>

      {!data.habilitado && data.motivo && (
        <Card className="p-6">
          <p className="text-fg-2">{data.motivo}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard eyebrow="POSIÇÃO COMISSÃO" value={posStr(data.posicaoComissao)} subtitle={`de ${data.totalParticipantes}`} />
        <KPICard eyebrow="POSIÇÃO VOLUME" value={posStr(data.posicaoVolume)} subtitle={`de ${data.totalParticipantes}`} />
        <KPICard eyebrow="POSIÇÃO TICKET" value={posStr(data.posicaoTicketMedio)} subtitle={`de ${data.totalParticipantes}`} />
        <KPICard
          eyebrow="PERCENTIL GLOBAL"
          value={data.percentilGlobal !== null ? `${data.percentilGlobal.toFixed(1).replace('.', ',')}%` : '—'}
          subtitle="comissão YTD"
          highlightValue
        />
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle eyebrow="MERCADO">Medianas anonimizadas</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-small">
          <div>
            <p className="eyebrow">COMISSÃO MEDIANA</p>
            <p className="t-num text-fg-1">{fmtBRL(data.medianaComissao)}</p>
            <p className="text-fg-3">Topo: {fmtBRL(data.destaque.melhorComissao)}</p>
          </div>
          <div>
            <p className="eyebrow">TICKET MÉDIO MEDIANO</p>
            <p className="t-num text-fg-1">{fmtBRL(data.medianaTicketMedio)}</p>
            <p className="text-fg-3">Topo: {fmtBRL(data.destaque.melhorTicket)}</p>
          </div>
          <div>
            <p className="eyebrow">VOLUME MEDIANO (t)</p>
            <p className="t-num text-fg-1">{data.medianaVolumeT.toLocaleString('pt-BR')}</p>
            <p className="text-fg-3">Topo: {data.destaque.melhorVolume.toLocaleString('pt-BR')} t</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
