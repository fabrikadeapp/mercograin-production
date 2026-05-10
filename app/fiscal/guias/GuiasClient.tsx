'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'
import { Plus, Check, X } from 'lucide-react'

interface Guia {
  id: string
  numero: string
  tipo: string
  codigoReceita: string
  contribuinteNome: string
  contribuinteDoc: string
  periodoApuracao: string
  valorPrincipal: number
  multa: number
  juros: number
  valorTotal: number
  vencimento: string
  status: string
  uf?: string | null
  linhaDigitavel?: string | null
}

interface Props {
  guias: Guia[]
  filtroTipo: string
  filtroStatus: string
}

export function GuiasClient({ guias, filtroTipo, filtroStatus }: Props) {
  const router = useRouter()
  const [showWizard, setShowWizard] = React.useState(false)
  const [tipo, setTipo] = React.useState<'darf' | 'gnre' | 'gare'>('darf')
  const [form, setForm] = React.useState({
    codigoReceita: '',
    contribuinteDoc: '',
    contribuinteNome: '',
    periodoApuracao: '',
    valorPrincipal: '',
    multa: '0',
    juros: '0',
    vencimento: '',
    uf: '',
    ie: '',
  })
  const [busy, setBusy] = React.useState(false)

  async function aplicarFiltros(t: string, s: string) {
    const params = new URLSearchParams()
    if (t) params.set('tipo', t)
    if (s) params.set('status', s)
    router.push(`/fiscal/guias?${params.toString()}`)
  }

  async function criar() {
    setBusy(true)
    try {
      const body: any = {
        tipo,
        codigoReceita: form.codigoReceita,
        contribuinteDoc: form.contribuinteDoc,
        contribuinteNome: form.contribuinteNome,
        periodoApuracao: form.periodoApuracao,
        valorPrincipal: parseFloat(form.valorPrincipal),
        multa: parseFloat(form.multa) || 0,
        juros: parseFloat(form.juros) || 0,
        vencimento: new Date(form.vencimento).toISOString(),
      }
      if (tipo === 'gnre') body.uf = form.uf
      if (tipo === 'gare') body.ie = form.ie

      const r = await fetch('/api/fiscal/guias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) {
        alert(`Erro: ${data.error}${data.detalhe ? ' · ' + data.detalhe : ''}`)
        return
      }
      setShowWizard(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function marcarPago(id: string) {
    if (!confirm('Marcar como paga?')) return
    const r = await fetch(`/api/fiscal/guias/${id}/marcar-pago`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (!r.ok) { alert('Falhou'); return }
    router.refresh()
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar guia?')) return
    const r = await fetch(`/api/fiscal/guias/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelado' }) })
    if (!r.ok) { alert('Falhou'); return }
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="flex flex-col gap-1 text-small">
          <span className="text-micro uppercase text-fg-3">Tipo</span>
          <select className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1" value={filtroTipo} onChange={(e) => aplicarFiltros(e.target.value, filtroStatus)}>
            <option value="">Todos</option>
            <option value="darf">DARF</option>
            <option value="gnre">GNRE</option>
            <option value="gare">GARE-SP</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          <span className="text-micro uppercase text-fg-3">Status</span>
          <select className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1" value={filtroStatus} onChange={(e) => aplicarFiltros(filtroTipo, e.target.value)}>
            <option value="">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <div className="ml-auto">
          <Button onClick={() => setShowWizard(true)}><Plus className="h-4 w-4 mr-1" /> Nova guia</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-small">
          <thead className="text-micro uppercase text-fg-3 bg-bg-2">
            <tr>
              <th className="px-3 py-2 text-left">Número</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Receita</th>
              <th className="px-3 py-2 text-left">Contribuinte</th>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Vencimento</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {guias.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-fg-3">Nenhuma guia.</td></tr>}
            {guias.map((g) => (
              <tr key={g.id} className="border-t border-border-1">
                <td className="px-3 py-2 font-mono">{g.numero}</td>
                <td className="px-3 py-2 uppercase">{g.tipo}{g.uf ? `/${g.uf}` : ''}</td>
                <td className="px-3 py-2">{g.codigoReceita}</td>
                <td className="px-3 py-2">{g.contribuinteNome}<div className="text-micro text-fg-3">{g.contribuinteDoc}</div></td>
                <td className="px-3 py-2 t-num">{g.periodoApuracao}</td>
                <td className="px-3 py-2 text-right t-num">R$ {g.valorTotal.toFixed(2)}</td>
                <td className="px-3 py-2">{new Date(g.vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2"><span className={g.status === 'pago' ? 'text-pos' : g.status === 'cancelado' ? 'text-fg-3' : 'text-warn'}>{g.status}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {g.status === 'aberto' && <>
                    <button className="text-pos mr-2" title="Marcar paga" onClick={() => marcarPago(g.id)}><Check className="inline h-4 w-4" /></button>
                    <button className="text-neg" title="Cancelar" onClick={() => cancelar(g.id)}><X className="inline h-4 w-4" /></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-1 border border-border-1 rounded-lg p-5 w-full max-w-lg">
            <h3 className="text-h3 mb-3">Nova guia</h3>
            <div className="grid grid-cols-2 gap-3 text-small">
              <label className="col-span-2">
                <span className="text-micro uppercase text-fg-3">Tipo</span>
                <select className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                  <option value="darf">DARF</option>
                  <option value="gnre">GNRE</option>
                  <option value="gare">GARE-SP</option>
                </select>
              </label>
              <label><span className="text-micro uppercase text-fg-3">Código receita</span><input className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.codigoReceita} onChange={(e) => setForm({ ...form, codigoReceita: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Período (YYYYMM)</span><input className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.periodoApuracao} onChange={(e) => setForm({ ...form, periodoApuracao: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Contribuinte (CPF/CNPJ)</span><input className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.contribuinteDoc} onChange={(e) => setForm({ ...form, contribuinteDoc: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Nome</span><input className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.contribuinteNome} onChange={(e) => setForm({ ...form, contribuinteNome: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Valor principal</span><input type="number" step="0.01" className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.valorPrincipal} onChange={(e) => setForm({ ...form, valorPrincipal: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Multa</span><input type="number" step="0.01" className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.multa} onChange={(e) => setForm({ ...form, multa: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Juros</span><input type="number" step="0.01" className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.juros} onChange={(e) => setForm({ ...form, juros: e.target.value })} /></label>
              <label><span className="text-micro uppercase text-fg-3">Vencimento</span><input type="date" className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></label>
              {tipo === 'gnre' && <label><span className="text-micro uppercase text-fg-3">UF</span><input maxLength={2} className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1 uppercase" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></label>}
              {tipo === 'gare' && <label><span className="text-micro uppercase text-fg-3">IE (opcional)</span><input className="w-full px-2 py-1 mt-1 rounded bg-bg-2 border border-border-1" value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} /></label>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowWizard(false)}>Cancelar</Button>
              <Button onClick={criar} disabled={busy}>{busy ? 'Salvando…' : 'Criar guia'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
