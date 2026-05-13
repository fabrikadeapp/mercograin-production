'use client'

import { useState } from 'react'
import { Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

type Status = 'idle' | 'sending' | 'success' | 'error'

interface Props {
  propostaId: string
  status: string
  /** Disparado quando uma ação completa com sucesso, para o pai recarregar */
  onChanged?: () => void
}

const STATUS_PODE_ENVIAR = ['rascunho', 'rascunho_ia', 'pronta_para_enviar', 'pendente']
const STATUS_TEM_APROVACAO = ['pendente_aprovacao']

export function PropostaAcoes({ propostaId, status, onChanged }: Props) {
  const [working, setWorking] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [confirmMotivo, setConfirmMotivo] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [motivo, setMotivo] = useState('')

  async function call(url: string, body?: object): Promise<{ ok: boolean; data?: unknown; status: number }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json().catch(() => ({}))) as unknown
    return { ok: res.ok, data, status: res.status }
  }

  async function handleEnviar() {
    setWorking('sending')
    setMessage(null)
    try {
      const r = await call(`/api/bhgrain/propostas/${propostaId}/enviar`)
      const data = r.data as { decisao?: string; motivos?: string[]; aprovacaoId?: string }

      if (r.status === 409 && data.decisao === 'bloqueado') {
        setWorking('error')
        setMessage(`Bloqueado: ${(data.motivos ?? []).join(' · ')}`)
        return
      }
      if (r.status === 202 && data.decisao === 'aprovacao') {
        setWorking('success')
        setMessage(`Proposta requer aprovação: ${(data.motivos ?? []).join(' · ')}`)
        onChanged?.()
        return
      }
      if (r.ok && data.decisao === 'permitido') {
        setWorking('success')
        setMessage('Proposta enviada com sucesso')
        onChanged?.()
        return
      }
      setWorking('error')
      setMessage('Erro inesperado ao enviar')
    } catch (e) {
      setWorking('error')
      setMessage(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleDecisao(decisao: 'aprovar' | 'rejeitar') {
    if (decisao === 'rejeitar' && !motivo.trim()) {
      setMessage('Informe o motivo da rejeição')
      return
    }
    setWorking('sending')
    setMessage(null)
    try {
      const r = await call(`/api/bhgrain/propostas/${propostaId}/aprovar`, {
        acao: decisao,
        motivo: motivo.trim() || undefined,
      })
      const data = r.data as { status?: string; etapaAtual?: number; totalEtapas?: number; error?: string }
      if (!r.ok) {
        setWorking('error')
        setMessage(data.error ?? `Erro ${r.status}`)
        return
      }
      setWorking('success')
      setConfirmMotivo(null)
      setMotivo('')
      if (data.status === 'aprovada') {
        setMessage('Aprovação concluída — proposta pronta para envio')
      } else if (data.status === 'rejeitada') {
        setMessage('Proposta rejeitada')
      } else {
        setMessage(`Etapa ${data.etapaAtual}/${data.totalEtapas} registrada`)
      }
      onChanged?.()
    } catch (e) {
      setWorking('error')
      setMessage(e instanceof Error ? e.message : 'Erro')
    }
  }

  const podeEnviar = STATUS_PODE_ENVIAR.includes(status.toLowerCase())
  const temAprovacao = STATUS_TEM_APROVACAO.includes(status.toLowerCase()) || status.toLowerCase().startsWith('rascunho_ia')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {podeEnviar && (
          <button
            type="button"
            disabled={working === 'sending'}
            onClick={handleEnviar}
            className="vg-btn vg-btn--primary text-[12px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            {working === 'sending' ? 'Enviando…' : 'Enviar proposta'}
          </button>
        )}
        {temAprovacao && (
          <>
            <button
              type="button"
              disabled={working === 'sending'}
              onClick={() => setConfirmMotivo('aprovar')}
              className="text-[12px] py-1.5 px-3 rounded font-semibold flex items-center gap-1.5"
              style={{ background: 'var(--vg-success, #10b981)', color: '#fff' }}
            >
              <CheckCircle2 className="w-3 h-3" /> Aprovar
            </button>
            <button
              type="button"
              disabled={working === 'sending'}
              onClick={() => setConfirmMotivo('rejeitar')}
              className="text-[12px] py-1.5 px-3 rounded font-semibold flex items-center gap-1.5"
              style={{ background: 'var(--vg-destructive, #ef4444)', color: '#fff' }}
            >
              <XCircle className="w-3 h-3" /> Rejeitar
            </button>
          </>
        )}
      </div>

      {confirmMotivo && (
        <div className="border rounded p-3 mt-2 space-y-2" style={{ borderColor: 'var(--vg-border-subtle)' }}>
          <div className="text-[12px] font-semibold">
            {confirmMotivo === 'aprovar' ? 'Aprovar proposta' : 'Rejeitar proposta'}
          </div>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={confirmMotivo === 'aprovar' ? 'Observação (opcional)' : 'Motivo da rejeição (obrigatório)'}
            rows={2}
            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-[12px]"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setConfirmMotivo(null); setMotivo(''); setMessage(null) }}
              className="text-[11px] px-3 py-1.5 rounded bg-white/10 hover:bg-white/15"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={working === 'sending'}
              onClick={() => handleDecisao(confirmMotivo)}
              className="text-[11px] px-3 py-1.5 rounded font-semibold disabled:opacity-50"
              style={{
                background: confirmMotivo === 'aprovar' ? 'var(--vg-success, #10b981)' : 'var(--vg-destructive, #ef4444)',
                color: '#fff',
              }}
            >
              Confirmar {confirmMotivo}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className="text-[11px] flex items-start gap-1.5 mt-2"
          style={{ color: working === 'error' ? 'var(--vg-destructive, #ef4444)' : 'var(--vg-success, #10b981)' }}
        >
          {working === 'error' ? <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}
