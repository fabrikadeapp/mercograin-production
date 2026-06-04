'use client'

import { useState } from 'react'
import { MoreVertical, Send, CheckCircle2, XCircle, FileText, MessageCircle, Copy } from 'lucide-react'
import { Dialog, Button, Select } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { AprovarComPreviewModal } from './AprovarComPreviewModal'

export interface PropostaRowActionsProps {
  proposta: {
    id: string
    numero: string
    status: string
    clienteId?: string
  }
  onRefresh: () => void
}

const LOSS_REASON_OPTIONS = [
  { value: 'preco', label: 'Preço (concorrente melhor)' },
  { value: 'concorrencia', label: 'Concorrência fechou primeiro' },
  { value: 'prazo', label: 'Prazo não atendia' },
  { value: 'qualidade', label: 'Qualidade/specs' },
  { value: 'logistica', label: 'Logística/frete' },
  { value: 'sem_resposta', label: 'Cliente sumiu' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_PODE_ENVIAR = new Set(['rascunho'])
const STATUS_PODE_APROVAR = new Set(['enviada', 'em_negociacao'])
const STATUS_PODE_PERDER = new Set(['rascunho', 'enviada', 'em_negociacao'])

export function PropostaRowActions({ proposta, onRefresh }: PropostaRowActionsProps) {
  const { success, error: showError } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [perdidaOpen, setPerdidaOpen] = useState(false)
  const [aprovarOpen, setAprovarOpen] = useState(false)
  const [lossReason, setLossReason] = useState('preco')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const status = proposta.status.toLowerCase()

  const acao = async (
    url: string,
    method: string,
    body: unknown,
    label: string,
    nomeAcao: string
  ) => {
    setLoading(nomeAcao)
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        showError(j.error || j.message || `Falha em ${label}`)
        return false
      }
      success(`${label} OK`)
      onRefresh()
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : `Erro em ${label}`)
      return false
    } finally {
      setLoading(null)
      setMenuOpen(false)
    }
  }

  const enviar = () =>
    acao(`/api/bhgrain/propostas/${proposta.id}/enviar`, 'POST', {}, 'Proposta enviada', 'enviar')

  const enviarWhatsApp = () =>
    acao(
      `/api/propostas/${proposta.id}/send-whatsapp`,
      'POST',
      {},
      'WhatsApp enviado',
      'whatsapp'
    )

  const aprovarComPreview = () => {
    setMenuOpen(false)
    setAprovarOpen(true)
  }

  const clonar = async () => {
    if (!confirm(`Clonar ${proposta.numero}? Nova proposta nasce como rascunho com validade +30 dias.`)) return
    await acao(
      `/api/propostas/${proposta.id}/clonar`,
      'POST',
      {},
      'Proposta clonada',
      'clonar'
    )
  }

  const submitPerdida = async () => {
    const ok = await acao(
      `/api/propostas/${proposta.id}/marcar-perdida`,
      'POST',
      { lossReason, observacoes: observacoes || undefined },
      'Marcada como perdida',
      'perdida'
    )
    if (ok) {
      setPerdidaOpen(false)
      setObservacoes('')
      setLossReason('preco')
    }
  }

  // Click-outside fecha menu
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  return (
    <>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleMenuToggle}
          className="chip"
          style={{ padding: '6px 8px' }}
          aria-label="Ações"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute right-0 mt-1 z-50 rounded-md shadow-pop overflow-hidden"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                minWidth: 220,
                boxShadow: 'var(--shadow-pop)',
              }}
            >
              {STATUS_PODE_ENVIAR.has(status) && (
                <MenuItem
                  icon={<Send className="h-3.5 w-3.5" />}
                  label="Enviar (mudar p/ enviada)"
                  loading={loading === 'enviar'}
                  onClick={enviar}
                />
              )}
              <MenuItem
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                label="Enviar por WhatsApp"
                loading={loading === 'whatsapp'}
                onClick={enviarWhatsApp}
              />
              <a
                href={`/api/propostas/${proposta.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <MenuItem icon={<FileText className="h-3.5 w-3.5" />} label="Baixar PDF" />
              </a>
              <MenuItem
                icon={<Copy className="h-3.5 w-3.5" />}
                label="Clonar (nova proposta)"
                loading={loading === 'clonar'}
                onClick={clonar}
              />
              {STATUS_PODE_APROVAR.has(status) && (
                <MenuItem
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Aprovar com preview…"
                  onClick={aprovarComPreview}
                />
              )}
              {STATUS_PODE_PERDER.has(status) && (
                <MenuItem
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  label="Marcar como perdida…"
                  danger
                  onClick={() => {
                    setPerdidaOpen(true)
                    setMenuOpen(false)
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      <AprovarComPreviewModal
        open={aprovarOpen}
        onClose={() => setAprovarOpen(false)}
        propostaId={proposta.id}
        propostaNumero={proposta.numero}
        onAprovado={() => onRefresh()}
      />

      <Dialog
        open={perdidaOpen}
        onOpenChange={setPerdidaOpen}
        title={`Marcar ${proposta.numero} como perdida`}
        description="Registre o motivo para alimentar análise de hit rate."
      >
        <div className="space-y-4">
          <Select
            label="Motivo *"
            options={LOSS_REASON_OPTIONS}
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="eyebrow">Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Detalhes do que aconteceu"
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
              loading={loading === 'perdida'}
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

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  danger?: boolean
  loading?: boolean
}

function MenuItem({ icon, label, onClick, danger, loading }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-2 px-3 py-2 text-small hover:bg-bg-3 transition-colors text-left disabled:opacity-50"
      style={{ color: danger ? 'var(--danger)' : 'var(--text)' }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {loading && <span className="text-[10px] opacity-60">…</span>}
    </button>
  )
}
