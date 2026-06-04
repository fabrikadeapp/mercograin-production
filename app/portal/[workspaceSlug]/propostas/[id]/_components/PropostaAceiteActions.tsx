'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  propostaId: string
  /** Reservado para futura navegação pós-aceite. */
  workspaceSlug: string
}

interface PreviewResp {
  html: string
  templateNome: string | null
  templateExiste: boolean
  variavelFaltando: string[]
}

export function PropostaAceiteActions({ propostaId }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState<
    'aceitar' | 'recusar' | 'preview' | 'contra-oferta' | null
  >(null)
  const [motivo, setMotivo] = useState('')
  const [aceitanteNome, setAceitanteNome] = useState('')
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (modalAberto !== 'preview' || preview) return
    setPreviewLoading(true)
    fetch(`/api/portal/propostas/${propostaId}/preview-contrato`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro ao gerar preview')
        setPreview(j as PreviewResp)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setPreviewLoading(false))
  }, [modalAberto, preview, propostaId])

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
        body: JSON.stringify({
          aceitanteNome: aceitanteNome.trim(),
          comentario: comentario.trim() || undefined,
        }),
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

  const submitContraOferta = async () => {
    if (!aceitanteNome.trim()) {
      setErro('Informe seu nome')
      return
    }
    if (!comentario.trim() || comentario.trim().length < 5) {
      setErro('Explique brevemente o que gostaria de mudar')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/portal/propostas/${propostaId}/contra-oferta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aceitanteNome: aceitanteNome.trim(),
          comentario: comentario.trim(),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error || 'Falha ao registrar contra-oferta')
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
              setModalAberto('preview')
              setErro(null)
            }}
            className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            👁  Ver contrato que será gerado
          </button>
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
              setModalAberto('contra-oferta')
              setErro(null)
            }}
            className="rounded-md border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
          >
            🔄 Aceitar com ressalvas
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
            className={`w-full ${modalAberto === 'preview' ? 'max-w-4xl' : 'max-w-lg'} rounded-lg bg-white p-6 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold">
              {modalAberto === 'aceitar'
                ? 'Aceitar proposta'
                : modalAberto === 'recusar'
                  ? 'Recusar proposta'
                  : modalAberto === 'contra-oferta'
                    ? 'Aceitar com ressalvas'
                    : 'Contrato que será gerado'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {modalAberto === 'aceitar'
                ? 'Confirme seu nome para registrar o aceite. Isso vale como manifestação formal de aceitação.'
                : modalAberto === 'recusar'
                  ? 'Informe o motivo. Sua resposta ajuda a equipe comercial a ajustar futuras propostas.'
                  : modalAberto === 'contra-oferta'
                    ? 'Explique brevemente o que gostaria de ajustar (preço, volume, prazo, condições). O vendedor vai receber a contra-proposta para revisar e voltar com resposta.'
                    : 'Este é o modelo que será preenchido com seus dados quando você aceitar. Confira antes de decidir.'}
            </p>

            <div className="mt-4 space-y-3">
              {modalAberto === 'preview' && (
                <div>
                  {previewLoading && (
                    <p className="py-8 text-center text-sm text-gray-500">Gerando preview…</p>
                  )}
                  {preview && (
                    <>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-gray-600">
                          {preview.templateExiste ? (
                            <>
                              Modelo: <strong>{preview.templateNome}</strong>
                            </>
                          ) : (
                            <span className="text-amber-700">⚠ Sem modelo configurado</span>
                          )}
                        </span>
                        {preview.templateExiste && preview.variavelFaltando.length > 0 && (
                          <span className="text-amber-700" title={preview.variavelFaltando.join(', ')}>
                            {preview.variavelFaltando.length} campos pendentes
                          </span>
                        )}
                      </div>
                      <div
                        className="max-h-[60vh] overflow-auto rounded border bg-white p-6 text-sm leading-relaxed text-gray-800"
                        dangerouslySetInnerHTML={{ __html: preview.html }}
                      />
                    </>
                  )}
                </div>
              )}
              {modalAberto === 'contra-oferta' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                      Seu nome completo *
                    </label>
                    <input
                      type="text"
                      value={aceitanteNome}
                      onChange={(e) => setAceitanteNome(e.target.value)}
                      placeholder="João Silva"
                      className="w-full rounded-md border px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                      O que gostaria de mudar? *
                    </label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={4}
                      maxLength={800}
                      placeholder="Ex: aceito se conseguir R$130/sc em vez de R$135/sc; ou prazo de entrega em 45 dias."
                      className="w-full rounded-md border px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Seu comentário é enviado para o vendedor junto com uma nova proposta-rascunho. Você não fica preso à proposta original.
                    </p>
                  </div>
                </>
              )}
              {modalAberto === 'aceitar' && (
                <>
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
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                      Observação (opcional)
                    </label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Ex: confirmo entrega em Sorriso até 30/06; condicional a OK do logística."
                      className="w-full rounded-md border px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Sua observação fica registrada junto com o aceite e visível para o vendedor.
                    </p>
                  </div>
                </>
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
                {modalAberto === 'preview' ? 'Fechar' : 'Cancelar'}
              </button>
              {modalAberto === 'preview' ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto('aceitar')
                    setErro(null)
                  }}
                  className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                >
                  Aceitar esta proposta
                </button>
              ) : modalAberto === 'contra-oferta' ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={submitContraOferta}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Enviar contra-oferta'}
                </button>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

