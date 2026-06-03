'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { Dialog, Button } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export interface AprovarComPreviewModalProps {
  open: boolean
  onClose: () => void
  propostaId: string
  propostaNumero: string
  /** Chamado depois de aprovação + criação de contrato bem-sucedidas. */
  onAprovado?: (resultado: { contratoId?: string | null; numero?: string | null }) => void
}

interface PreviewResponse {
  html: string
  templateNome: string | null
  templateId?: string | null
  templateExiste: boolean
  variavelFaltando: string[]
}

export function AprovarComPreviewModal({
  open,
  onClose,
  propostaId,
  propostaNumero,
  onAprovado,
}: AprovarComPreviewModalProps) {
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [aprovando, setAprovando] = useState(false)

  useEffect(() => {
    if (!open) {
      setPreview(null)
      return
    }
    setLoading(true)
    fetch(`/api/propostas/${propostaId}/preview-contrato`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro ao gerar preview')
        setPreview(j as PreviewResponse)
      })
      .catch((err) => {
        showError(err instanceof Error ? err.message : 'Erro ao gerar preview')
        onClose()
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propostaId])

  const aprovar = async () => {
    setAprovando(true)
    try {
      const r = await fetch(`/api/bhgrain/propostas/${propostaId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'aprovar' }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao aprovar')
      success(
        j.contrato?.novo
          ? `Aprovada. Contrato ${j.contrato.numero} criado.`
          : 'Aprovada.'
      )
      onAprovado?.({ contratoId: j.contrato?.contratoId, numero: j.contrato?.numero })
      onClose()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao aprovar')
    } finally {
      setAprovando(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title={`Aprovar proposta ${propostaNumero}`}
      description="Confira o contrato que será gerado. Ao confirmar, a proposta é aprovada e o contrato criado."
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-fg-3 py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando preview…
          </div>
        )}

        {preview && (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap text-small">
              <span className="text-fg-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {preview.templateExiste ? (
                  <>
                    Template: <strong className="text-fg-1">{preview.templateNome}</strong>
                  </>
                ) : (
                  <span className="text-warn flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sem template configurado
                  </span>
                )}
              </span>
              {preview.templateExiste && preview.variavelFaltando.length > 0 && (
                <span
                  className="text-warn text-[12px]"
                  title={preview.variavelFaltando.join(', ')}
                >
                  ⚠ {preview.variavelFaltando.length} variáveis sem dados:{' '}
                  <span className="font-mono">
                    {preview.variavelFaltando.slice(0, 3).join(', ')}
                    {preview.variavelFaltando.length > 3 && '…'}
                  </span>
                </span>
              )}
            </div>

            <div
              className="rounded-md overflow-auto"
              style={{
                background: 'white',
                color: '#222',
                padding: 24,
                maxHeight: '60vh',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="contrato-preview"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>

            <style jsx>{`
              :global(.contrato-preview h1) {
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 12px;
              }
              :global(.contrato-preview h2) {
                font-size: 18px;
                font-weight: 700;
                margin: 16px 0 8px;
              }
              :global(.contrato-preview h3) {
                font-size: 15px;
                font-weight: 700;
                margin: 12px 0 6px;
              }
              :global(.contrato-preview p) {
                margin: 0 0 10px;
                line-height: 1.55;
              }
              :global(.contrato-preview ul, .contrato-preview ol) {
                margin: 8px 0 12px 24px;
              }
              :global(.contrato-preview table) {
                border-collapse: collapse;
                margin: 12px 0;
                width: 100%;
              }
              :global(.contrato-preview td, .contrato-preview th) {
                border: 1px solid #ddd;
                padding: 6px 10px;
              }
              :global(.contrato-preview blockquote) {
                border-left: 3px solid #ccc;
                padding-left: 12px;
                color: #555;
                margin: 12px 0;
              }
            `}</style>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-1">
          <p className="text-fg-3 text-[11px] flex-1">
            Após aprovar, você poderá editar o contrato em <code>/contratos</code> antes de enviar para assinatura.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              loading={aprovando}
              disabled={loading}
              onClick={aprovar}
            >
              Confirmar aprovação
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
