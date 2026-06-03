'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  propostaId: string
  /** Reservado para futura navegação pós-aceite. */
  workspaceSlug: string
}

export function PropostaAceiteActions({ propostaId }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState<'aceitar' | 'recusar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [aceitanteNome, setAceitanteNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const submitAceite = async () => {
    if (!aceitanteNome.trim()) {
      setErro('Informe seu nome para registrar o aceite')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/portal/propostas/${propostaId}/aceitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceitanteNome: aceitanteNome.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error || 'Falha ao aceitar')
        return
      }
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  const submitRecusa = async () => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da recusa')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/portal/propostas/${propostaId}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error || 'Falha ao recusar')
        return
      }
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Decidir esta proposta</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ao aceitar, o vendedor é notificado e o contrato será preparado para sua
          assinatura. Recusar registra o motivo para a equipe comercial.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setModalAberto('aceitar')
              setErro(null)
            }}
            className="rounded-md bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            ✓ Aceitar proposta
          </button>
          <button
            type="button"
            onClick={() => {
              setModalAberto('recusar')
              setErro(null)
            }}
            className="rounded-md border border-red-300 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            ✗ Recusar proposta
          </button>
        </div>
      </section>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !loading && setModalAberto(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold">
              {modalAberto === 'aceitar' ? 'Aceitar proposta' : 'Recusar proposta'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {modalAberto === 'aceitar'
                ? 'Confirme seu nome para registrar o aceite. Isso vale como manifestação formal de aceitação.'
                : 'Informe o motivo. Sua resposta ajuda a equipe comercial a ajustar futuras propostas.'}
            </p>

            <div className="mt-4 space-y-3">
              {modalAberto === 'aceitar' && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                    Seu nome completo *
                  </label>
                  <input
                    type="text"
                    value={aceitanteNome}
                    onChange={(e) => setAceitanteNome(e.target.value)}
                    placeholder="João Silva"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                    autoFocus
                  />
                </div>
              )}
              {modalAberto === 'recusar' && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                    Motivo *
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={4}
                    placeholder="Preço, prazo, especificações..."
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                    autoFocus
                  />
                </div>
              )}

              {erro && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setModalAberto(null)}
                className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={modalAberto === 'aceitar' ? submitAceite : submitRecusa}
                className={
                  modalAberto === 'aceitar'
                    ? 'rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60'
                    : 'rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60'
                }
              >
                {loading
                  ? 'Enviando…'
                  : modalAberto === 'aceitar'
                    ? 'Confirmar aceite'
                    : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

