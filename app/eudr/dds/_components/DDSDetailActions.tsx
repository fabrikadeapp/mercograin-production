'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/components/ui/phb'

interface Props {
  dds: {
    id: string
    conclusao: string
    atestadoEm: string | null
    pdfUrl: string | null
    riscoNivel: string
  }
}

export function DDSDetailActions({ dds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [okMsg, setOkMsg] = React.useState<string | null>(null)

  async function call(path: string, key: string) {
    setLoading(key)
    setErr(null)
    setOkMsg(null)
    try {
      const r = await fetch(path, { method: 'POST' })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      setOkMsg(`OK · ${key}`)
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!!loading}
          onClick={() => call(`/api/eudr/dds/${dds.id}/render-pdf`, 'render')}
        >
          {loading === 'render' ? 'Gerando PDF...' : dds.pdfUrl ? 'Regerar PDF' : 'Gerar PDF'}
        </Button>

        {dds.pdfUrl ? (
          <a href={dds.pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="ghost">Baixar PDF</Button>
          </a>
        ) : null}

        {!dds.atestadoEm ? (
          <Button
            disabled={!!loading || dds.riscoNivel === 'critico'}
            onClick={() => call(`/api/eudr/dds/${dds.id}/atestar`, 'atestar')}
            title={dds.riscoNivel === 'critico' ? 'Mitigue o risco crítico antes' : 'Atestar DDS'}
          >
            {loading === 'atestar' ? 'Atestando...' : 'Atestar DDS'}
          </Button>
        ) : (
          <span className="text-xs text-emerald-400">
            Atestada em {new Date(dds.atestadoEm).toLocaleString('pt-BR')}
          </span>
        )}
      </div>
      {err ? <p className="text-xs text-red-400 mt-2">{err}</p> : null}
      {okMsg ? <p className="text-xs text-emerald-400 mt-2">{okMsg}</p> : null}
    </Card>
  )
}
