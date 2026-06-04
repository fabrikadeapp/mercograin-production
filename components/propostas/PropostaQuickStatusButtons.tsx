'use client'

import { useState } from 'react'
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { Dialog, Button, Select } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export interface PropostaQuickStatusButtonsProps {
  proposta: {
    id: string
    numero: string
    status: string
  }
  onRefresh: () => void
}

const LOSS_REASONS = [
  { value: 'preco', label: 'Preço' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'prazo', label: 'Prazo' },
  { value: 'qualidade', label: 'Qualidade' },
  { value: 'logistica', label: 'Logística' },
  { value: 'sem_resposta', label: 'Sem resposta' },
  { value: 'outro', label: 'Outro' },
]

/**
 * Botões inline de transição rápida de status para a linha da lista.
 * Mostra ações contextuais conforme o status atual:
 *   - rascunho        → "Enviar"
 *   - enviada         → "Em negociação" / "Aceita" / "Perdida"
 *   - em_negociacao   → "Aceita" / "Perdida"
 *
 * Usa PATCH /api/propostas/[id]/status com validação no servidor.
 * Para 'perdida' abre modal pedindo lossReason.
 */
export function PropostaQuickStatusButtons({
  proposta,
  onRefresh,
}: PropostaQuickStatusButtonsProps) {
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [perdidaOpen, setPerdidaOpen] = useState(false)
  const [lossReason, setLossReason] = useState('preco')
  const [comentario, setComentario] = useState('')

  const status = proposta.status.toLowerCase()

  const mudarStatus = async (
    novoStatus: string,
    labelAcao: string,
    extra?: { lossReason?: string; comentario?: string }
  ) => {
    setLoading(labelAcao)
    try {
      const r = await fetch(`/api/propostas/${proposta.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus,
          lossReason: extra?.lossReason,
          comentario: extra?.comentario,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        showError(j.error || `Falha em ${labelAcao}`)
        return false
      }
      success(`${labelAcao} OK`)
      onRefresh()
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro')
      return false
    } finally {
      setLoading(null)
    }
  }

  const enviar = () => mudarStatus('enviada', 'Enviar')
  const negociacao = () => mudarStatus('em_negociacao', 'Negociação')
  const aceitar = async () => {
    if (!confirm(`Marcar ${proposta.numero} como ACEITA? Vai gerar contrato.`)) return
    await mudarStatus('aceita', 'Aceitar')
  }

  const submitPerdida = async () => {
    const ok = await mudarStatus('perdida', 'Marcar perdida', {
      lossReason,
      comentario: comentario.trim() || undefined,
    })
    if (ok) {
      setPerdidaOpen(false)
      setComentario('')
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rascunho → Enviar */}
        {status === 'rascunho' && (
          <button
            type="button"
            onClick={enviar}
            disabled={loading !== null}
            className="chip"
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontWeight: 600,
            }}
            title="Marcar como enviada"
          >
            {loading === 'Enviar' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" />
                Enviar
              </>
            )}
          </button>
        )}

        {/* Enviada → Em negociação */}
        {status === 'enviada' && (
          <button
            type="button"
            onClick={negociacao}
            disabled={loading !== null}
            className="chip"
            style={{ padding: '4px 8px', fontSize: 11 }}
            title="Mover para em negociação"
          >
            {loading === 'Negociação' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                Negociar
              </>
            )}
          </button>
        )}

        {/* Enviada/Negociação → Aceita */}
        {(status === 'enviada' || status === 'em_negociacao') && (
          <button
            type="button"
            onClick={aceitar}
            disabled={loading !== null}
            className="chip"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--success)',
              color: 'white',
              fontWeight: 600,
            }}
            title="Cliente aceitou — gera contrato"
          >
            {loading === 'Aceitar' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Aceita
              </>
            )}
          </button>
        )}

        {/* Enviada/Negociação/Rascunho → Perdida */}
        {(status === 'rascunho' ||
          status === 'enviada' ||
          status === 'em_negociacao') && (
          <button
            type="button"
            onClick={() => setPerdidaOpen(true)}
            disabled={loading !== null}
            className="chip"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: 'var(--danger)',
            }}
            title="Marcar como perdida (precisa motivo)"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Perdida
          </button>
        )}
      </div>

      <Dialog
        open={perdidaOpen}
        onOpenChange={setPerdidaOpen}
        title={`Marcar ${proposta.numero} como perdida`}
        description="Registre o motivo da perda."
      >
        <div className="space-y-4">
          <Select
            label="Motivo *"
            options={LOSS_REASONS}
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="eyebrow">Comentário (opcional)</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Detalhes da conversa, contexto…"
              className="w-full px-4 py-3 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPerdidaOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={loading === 'Marcar perdida'}
              onClick={submitPerdida}
            >
              Confirmar perda
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
