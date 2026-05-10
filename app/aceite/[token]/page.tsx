'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ContratoResumo {
  numero: string
  dataInicio: string
  dataFim: string | null
  modalidade: string
  pdfUrl: string | null
  pdfHash: string | null
  cliente: { nome: string } | null
  proposta: { numero: string; valorTotal: number; tipo: string } | null
  corretora: string | null
}

type Status = 'pendente' | 'aceito' | 'recusado' | 'expirado'

export default function AceitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [contrato, setContrato] = useState<ContratoResumo | null>(null)

  const [nome, setNome] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'aceito' | 'recusado' | null>(null)
  const [shareGeo, setShareGeo] = useState(true)

  useEffect(() => {
    fetch(`/api/aceite/${token}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || 'Erro ao carregar contrato')
        } else {
          setStatus(data.status)
          setContrato(data.contrato)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Falha ao carregar')
        setLoading(false)
      })
  }, [token])

  async function getGeo(): Promise<{ lat?: number; lng?: number }> {
    if (!shareGeo || !navigator.geolocation) return {}
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 }
      )
    })
  }

  async function submitAceitar() {
    if (!nome.trim()) {
      setError('Informe seu nome completo')
      return
    }
    setSubmitting(true)
    setError('')
    const geo = await getGeo()
    const r = await fetch(`/api/aceite/${token}/aceitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aceitanteNome: nome,
        aceitanteCpfCnpj: cpfCnpj || undefined,
        geoLat: geo.lat,
        geoLng: geo.lng,
      }),
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Erro')
      setSubmitting(false)
      return
    }
    setDone('aceito')
    setSubmitting(false)
  }

  async function submitRecusar() {
    if (!motivo.trim()) {
      setError('Informe o motivo da recusa')
      return
    }
    setSubmitting(true)
    setError('')
    const r = await fetch(`/api/aceite/${token}/recusar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aceitanteNome: nome || undefined, motivo }),
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Erro')
      setSubmitting(false)
      return
    }
    setDone('recusado')
    setSubmitting(false)
  }

  if (loading) {
    return <div className="p-10 text-center">Carregando…</div>
  }

  if (error && !contrato) {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="p-6 rounded-lg border border-red-200 bg-red-50 text-red-800">
          {error}
        </div>
      </div>
    )
  }

  if (!contrato) return null

  if (done === 'aceito' || status === 'aceito') {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="p-6 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
          <h1 className="text-xl font-bold mb-2">Contrato aceito ✓</h1>
          <p>
            Seu aceite foi registrado. Uma cópia foi enviada à corretora{' '}
            {contrato.corretora}.
          </p>
        </div>
      </div>
    )
  }

  if (done === 'recusado' || status === 'recusado') {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="p-6 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <h1 className="text-xl font-bold mb-2">Aceite recusado</h1>
          <p>A corretora foi notificada da sua decisão.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="border-b pb-4">
        <p className="text-sm text-gray-500">Aceite digital de contrato</p>
        <h1 className="text-2xl font-bold">Contrato {contrato.numero}</h1>
        {contrato.corretora && (
          <p className="text-gray-600 mt-1">Corretora: {contrato.corretora}</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Info label="Cliente" value={contrato.cliente?.nome ?? '—'} />
        <Info label="Modalidade" value={contrato.modalidade} />
        <Info
          label="Início"
          value={new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}
        />
        <Info
          label="Fim"
          value={
            contrato.dataFim
              ? new Date(contrato.dataFim).toLocaleDateString('pt-BR')
              : '—'
          }
        />
        {contrato.proposta && (
          <Info
            label="Valor da proposta"
            value={`R$ ${Number(contrato.proposta.valorTotal).toLocaleString(
              'pt-BR',
              { minimumFractionDigits: 2 }
            )}`}
          />
        )}
      </div>

      {contrato.pdfUrl && (
        <a
          href={contrato.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded border hover:bg-gray-50"
        >
          📄 Baixar contrato em PDF
        </a>
      )}
      {contrato.pdfHash && (
        <p className="text-xs text-gray-500 font-mono break-all">
          SHA-256: {contrato.pdfHash}
        </p>
      )}

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-4 border-t pt-4">
        <h2 className="font-semibold">Identificação</h2>
        <input
          type="text"
          placeholder="Seu nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <input
          type="text"
          placeholder="CPF ou CNPJ (opcional)"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shareGeo}
            onChange={(e) => setShareGeo(e.target.checked)}
          />
          Permitir registro de localização (opcional, fortalece evidência)
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={submitAceitar}
            disabled={submitting}
            className="px-5 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            ✓ Aceitar contrato
          </button>
          <details className="ml-auto">
            <summary className="cursor-pointer px-3 py-2 text-red-700">
              Recusar
            </summary>
            <div className="mt-2 space-y-2">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo da recusa"
                className="border rounded px-3 py-2 w-full"
                rows={3}
              />
              <button
                onClick={submitRecusar}
                disabled={submitting}
                className="px-4 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50"
              >
                Confirmar recusa
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
