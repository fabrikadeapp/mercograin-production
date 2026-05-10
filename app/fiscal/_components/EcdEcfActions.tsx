'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'
import { FileDown } from 'lucide-react'

interface Props {
  tipo: 'ecd' | 'ecf'
  anoAtual: number
}

/**
 * Botão p/ disparar geração ECD/ECF anual. Payload mínimo (DRE zerada ou plano
 * vazio) — o backend trata e gera arquivo skeleton; usuário completa com
 * dados contábeis via integração ou upload posterior.
 */
export function EcdEcfActions({ tipo, anoAtual }: Props) {
  const router = useRouter()
  const [ano, setAno] = React.useState(anoAtual)
  const [busy, setBusy] = React.useState(false)

  async function gerar() {
    setBusy(true)
    try {
      const url = tipo === 'ecd' ? '/api/fiscal/sped/ecd' : '/api/fiscal/sped/ecf'
      const body: any = { anoFiscal: ano }
      if (tipo === 'ecf') {
        body.dadosDRE = {
          receitaBruta: 0, deducoes: 0, receitaLiquida: 0, custos: 0,
          lucroBruto: 0, despesasOperacionais: 0, resultadoOperacional: 0,
          outrasReceitas: 0, outrasDespesas: 0, lucroAntesIR: 0,
          irpj: 0, csll: 0, lucroLiquido: 0,
        }
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) {
        alert(`Erro: ${data.error ?? r.status}${data.detalhe ? ' · ' + data.detalhe : ''}`)
        return
      }
      router.refresh()
      alert(`${tipo.toUpperCase()} ${ano} gerado: ${data.totalRegistros} registros`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-small">
        <span className="text-micro uppercase text-fg-3">Ano fiscal</span>
        <input
          type="number"
          className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1 text-fg-1 t-num w-28"
          value={ano}
          onChange={(e) => setAno(parseInt(e.target.value, 10))}
          min={2000}
          max={2100}
        />
      </label>
      <Button onClick={gerar} disabled={busy}>
        <FileDown className="h-4 w-4 mr-1" /> {busy ? 'Gerando…' : `Gerar ${tipo.toUpperCase()}`}
      </Button>
    </div>
  )
}
