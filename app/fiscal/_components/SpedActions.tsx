'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'
import { FileDown } from 'lucide-react'

interface Props {
  tipo: 'fiscal' | 'contribuicoes'
  competencia: string
  compAtual: string
}

export function SpedActions({ tipo, competencia: compDefault, compAtual }: Props) {
  const router = useRouter()
  const [comp, setComp] = React.useState(compDefault)
  const [busy, setBusy] = React.useState(false)

  async function gerar() {
    if (!/^\d{6}$/.test(comp)) {
      alert('Competência deve estar no formato YYYYMM (ex: 202604)')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/fiscal/sped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, competencia: comp }),
      })
      const data = await r.json()
      if (!r.ok) {
        alert(`Erro: ${data.error ?? r.status}${data.detalhe ? ' · ' + data.detalhe : ''}`)
        return
      }
      router.refresh()
      alert(`SPED gerado: ${data.totalRegistros} registros (${data.notas ?? 0} notas)`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-small">
        <span className="text-micro uppercase text-fg-3">Competência</span>
        <input
          className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1 text-fg-1 t-num w-32"
          value={comp}
          onChange={(e) => setComp(e.target.value)}
          placeholder="YYYYMM"
          maxLength={6}
        />
        <span className="text-micro text-fg-3">Mês atual: {compAtual}</span>
      </label>
      <Button onClick={gerar} disabled={busy}>
        <FileDown className="h-4 w-4 mr-1" /> {busy ? 'Gerando…' : 'Gerar SPED'}
      </Button>
    </div>
  )
}
