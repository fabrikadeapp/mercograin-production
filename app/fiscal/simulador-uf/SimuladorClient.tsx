'use client'
import * as React from 'react'
import { Button } from '@/components/ui/phb'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const CULTURAS = ['soja','milho','cafe','trigo','algodao','sorgo','outro']

interface Decomp {
  icms: { aliquota: number; valor: number; diferido: boolean; creditoPresumido: number }
  pis: { aliquota: number; valor: number }
  cofins: { aliquota: number; valor: number }
  irpj: { aliquota: number; valor: number }
  csll: { aliquota: number; valor: number }
  funrural: { aliquota: number; valor: number }
  totalTributos: number
  valorLiquido: number
  cargaEfetiva: number
}

export function SimuladorClient() {
  const [origem, setOrigem] = React.useState('MT')
  const [destino, setDestino] = React.useState('SP')
  const [cultura, setCultura] = React.useState('soja')
  const [valor, setValor] = React.useState('1000000')
  const [regime, setRegime] = React.useState<'lucro_real' | 'lucro_presumido' | 'simples'>('lucro_presumido')
  const [destinatario, setDestinatario] = React.useState<'PF' | 'PJ'>('PJ')
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<null | { origem: Decomp; destino: Decomp; recomendacao: string; economiaAbsoluta: number; economiaPercentual: number }>(null)

  async function simular() {
    setBusy(true)
    try {
      const r = await fetch('/api/fiscal/simulador-uf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origemUF: origem,
          destinoUF: destino,
          cultura,
          valorTotal: parseFloat(valor),
          regime,
          destinatarioTipo: destinatario,
        }),
      })
      const data = await r.json()
      if (!r.ok) { alert(data.error ?? 'Falhou'); return }
      setResult(data.data)
    } finally {
      setBusy(false)
    }
  }

  function fmt(n: number) { return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <label><span className="text-micro uppercase text-fg-3">UF origem</span>
          <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label><span className="text-micro uppercase text-fg-3">UF destino</span>
          <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label><span className="text-micro uppercase text-fg-3">Cultura</span>
          <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={cultura} onChange={(e) => setCultura(e.target.value)}>
            {CULTURAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label><span className="text-micro uppercase text-fg-3">Valor total (R$)</span>
          <input type="number" step="0.01" className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1 t-num" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label><span className="text-micro uppercase text-fg-3">Regime</span>
          <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={regime} onChange={(e) => setRegime(e.target.value as any)}>
            <option value="lucro_real">Lucro Real</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="simples">Simples Nacional</option>
          </select>
        </label>
        <label><span className="text-micro uppercase text-fg-3">Destinatário</span>
          <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={destinatario} onChange={(e) => setDestinatario(e.target.value as any)}>
            <option value="PJ">Pessoa Jurídica</option>
            <option value="PF">Pessoa Física</option>
          </select>
        </label>
      </div>
      <Button onClick={simular} disabled={busy}>{busy ? 'Calculando…' : 'Simular'}</Button>

      {result && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['origem', 'destino'] as const).map((lado) => {
            const d = result[lado]
            const uf = lado === 'origem' ? origem : destino
            return (
              <div key={lado} className="rounded border border-border-1 p-4">
                <div className="text-h3 mb-2">Operar em {uf}</div>
                <table className="w-full text-small">
                  <tbody>
                    <tr><td>ICMS ({d.icms.aliquota}%)</td><td className="text-right t-num">{fmt(d.icms.valor)}{d.icms.diferido && <span className="text-pos ml-1 text-micro">DIFERIDO</span>}</td></tr>
                    <tr><td className="pl-3 text-fg-3 text-micro">crédito presumido</td><td className="text-right t-num text-fg-3">{fmt(d.icms.creditoPresumido)}</td></tr>
                    <tr><td>PIS ({d.pis.aliquota}%)</td><td className="text-right t-num">{fmt(d.pis.valor)}</td></tr>
                    <tr><td>COFINS ({d.cofins.aliquota}%)</td><td className="text-right t-num">{fmt(d.cofins.valor)}</td></tr>
                    <tr><td>IRPJ ({d.irpj.aliquota}%)</td><td className="text-right t-num">{fmt(d.irpj.valor)}</td></tr>
                    <tr><td>CSLL ({d.csll.aliquota}%)</td><td className="text-right t-num">{fmt(d.csll.valor)}</td></tr>
                    <tr><td>FUNRURAL ({d.funrural.aliquota}%)</td><td className="text-right t-num">{fmt(d.funrural.valor)}</td></tr>
                    <tr className="border-t border-border-1"><td className="font-semibold">Total tributos</td><td className="text-right t-num font-semibold">{fmt(d.totalTributos)}</td></tr>
                    <tr><td className="text-fg-3">Valor líquido</td><td className="text-right t-num">{fmt(d.valorLiquido)}</td></tr>
                    <tr><td className="text-fg-3">Carga efetiva</td><td className="text-right t-num">{d.cargaEfetiva.toFixed(2)}%</td></tr>
                  </tbody>
                </table>
              </div>
            )
          })}
          <div className="md:col-span-2 p-4 rounded bg-bg-2 border border-border-1">
            <strong>Recomendação:</strong> {result.recomendacao}
          </div>
        </div>
      )}
    </div>
  )
}
