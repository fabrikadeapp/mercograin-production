'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button } from '@/components/ui/phb'

interface Props {
  aprovacao: any
}

export function AprovacaoCard({ aprovacao }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [showMotivo, setShowMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const decidir = async (decisao: 'aprovado' | 'rejeitado') => {
    setLoading(decisao === 'aprovado' ? 'aprovar' : 'rejeitar')
    setErro(null)
    try {
      const res = await fetch(`/api/aprovacoes/${aprovacao.id}/decidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, motivo }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Erro')
      }
      router.refresh()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(null)
    }
  }

  const prazo = new Date(aprovacao.prazoEtapaAtual)
  const atrasado = prazo.getTime() < Date.now()
  const snapshot = aprovacao.snapshot || {}
  const valor = snapshot.valorTotal
    ? `R$ ${Number(snapshot.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '—'

  return (
    <Card>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-sm">
              {aprovacao.workflow.nome}{' '}
              <span className="text-xs text-zinc-500 font-normal">
                · {aprovacao.entidadeTipo}
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Solicitado por {aprovacao.solicitante.nome} ·{' '}
              {snapshot.numero && <>nº {snapshot.numero} · </>}
              valor {valor}
            </p>
          </div>
          <div className="flex gap-2 items-center text-xs">
            <span className="px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">
              Etapa {aprovacao.etapaAtual}/{aprovacao.totalEtapas}
            </span>
            <span
              className={
                'px-2 py-1 rounded-full ' +
                (atrasado
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700')
              }
            >
              Prazo {prazo.toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {showMotivo && (
          <textarea
            className="w-full text-sm border rounded p-2"
            placeholder="Motivo (obrigatório para rejeitar)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
          />
        )}

        {erro && <p className="text-red-600 text-xs">{erro}</p>}

        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={loading !== null}
            onClick={() => decidir('aprovado')}
          >
            {loading === 'aprovar' ? 'Aprovando...' : 'Aprovar'}
          </Button>
          <Button
            variant="ghost"
            disabled={loading !== null}
            onClick={() => {
              if (!showMotivo) {
                setShowMotivo(true)
                return
              }
              decidir('rejeitado')
            }}
          >
            {loading === 'rejeitar'
              ? 'Rejeitando...'
              : showMotivo
                ? 'Confirmar rejeição'
                : 'Rejeitar'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
