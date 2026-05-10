'use client'

import { useEffect, useState } from 'react'
import { Card, Button } from '@/components/ui/phb'
import { Chip, type ChipVariant } from '@/components/ui/phb/primitives/Chip'
import { useToast } from '@/contexts/ToastContext'
import { Send, X, Copy, FileDown, Loader2 } from 'lucide-react'

interface Signatario {
  ordem?: number
  name: string
  cpfCnpj: string
  email?: string | null
  phone?: string | null
  authMode: 'simple' | 'icp_brasil' | 'sms' | 'email_token'
  signedAt?: string | null
  refusedAt?: string | null
  ip?: string | null
  signUrl?: string | null
}

interface Assinatura {
  id: string
  providerNome: string
  providerDocId: string
  status: 'pendente' | 'parcial' | 'assinado' | 'recusado' | 'expirado' | 'cancelado'
  authMode: string
  signatarios: Signatario[]
  pdfAssinadoUrl?: string | null
  pdfAssinadoHash?: string | null
  pdfOriginalHash?: string | null
  enviadoEm: string
  finalizadoEm?: string | null
}

interface Props {
  contratoId: string
  contratoNumero: string
  statusAssinatura: 'pendente' | 'enviada' | 'assinado' | 'cancelado'
}

const STATUS_CHIP: Record<string, ChipVariant> = {
  pendente: 'warn',
  parcial: 'info',
  assinado: 'pos',
  recusado: 'neg',
  expirado: 'neg',
  cancelado: 'neg',
}

export function AssinaturaDigitalPanel({
  contratoId,
  contratoNumero,
  statusAssinatura,
}: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ass, setAss] = useState<Assinatura | null>(null)
  const [openSendModal, setOpenSendModal] = useState(false)
  const [signatorios, setSignatorios] = useState<Signatario[]>([
    { name: '', cpfCnpj: '', email: '', authMode: 'simple' },
  ])

  async function reload() {
    setLoading(true)
    try {
      const r = await fetch(`/api/contratos/${contratoId}`)
      const data = await r.json()
      setAss(data?.assinaturaDigital ?? null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [contratoId])

  async function enviar() {
    if (signatorios.some((s) => !s.name || !s.cpfCnpj)) {
      toast.error('Preencha nome e CPF/CNPJ de todos os signatários')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(`/api/contratos/${contratoId}/enviar-assinatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatorios: signatorios.map((s) => ({
            nome: s.name,
            cpfCnpj: s.cpfCnpj,
            email: s.email || undefined,
            telefone: s.phone || undefined,
            authMode: s.authMode,
          })),
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        toast.error(data?.error || 'Falha ao enviar')
      } else {
        toast.success(`Enviado via ${data.provider}`)
        setOpenSendModal(false)
        await reload()
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro')
    }
    setBusy(false)
  }

  async function cancelar() {
    const motivo = prompt('Motivo do cancelamento (mín 3 caracteres):')
    if (!motivo || motivo.length < 3) return
    setBusy(true)
    try {
      const r = await fetch(`/api/contratos/${contratoId}/cancelar-assinatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const data = await r.json()
      if (!r.ok) toast.error(data?.error || 'Falha')
      else {
        toast.success('Fluxo de assinatura cancelado')
        await reload()
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro')
    }
    setBusy(false)
  }

  function addSig() {
    setSignatorios([
      ...signatorios,
      { name: '', cpfCnpj: '', email: '', authMode: 'simple' },
    ])
  }
  function rmSig(i: number) {
    setSignatorios(signatorios.filter((_, idx) => idx !== i))
  }
  function updSig(i: number, patch: Partial<Signatario>) {
    setSignatorios(signatorios.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Assinatura digital</p>
          <p className="text-fg-2 text-small mt-1">
            Contrato {contratoNumero}
          </p>
        </div>
        {ass && (
          <Chip variant={STATUS_CHIP[ass.status] ?? 'warn'}>{ass.status}</Chip>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-fg-3 text-small">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && !ass && statusAssinatura !== 'assinado' && (
        <div className="space-y-3">
          <p className="text-fg-2 text-small">
            Nenhum fluxo de assinatura criado ainda.
          </p>
          <Button leftIcon={<Send className="h-4 w-4" />} onClick={() => setOpenSendModal(true)}>
            Enviar para assinatura
          </Button>
        </div>
      )}

      {!loading && ass && (
        <div className="space-y-3">
          <div className="text-small text-fg-2">
            Provider: <span className="font-mono">{ass.providerNome}</span>
            {' · '}
            Doc: <span className="font-mono">{ass.providerDocId.slice(0, 16)}…</span>
          </div>

          <div className="border border-border-1 rounded divide-y divide-border-1">
            {ass.signatarios.map((s, i) => (
              <div key={i} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fg-1 font-medium truncate">{s.name}</p>
                  <p className="text-fg-3 text-small font-mono">{s.cpfCnpj}</p>
                  {s.email && <p className="text-fg-3 text-small">{s.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {s.signedAt ? (
                    <Chip variant="pos">Assinou</Chip>
                  ) : s.refusedAt ? (
                    <Chip variant="neg">Recusou</Chip>
                  ) : (
                    <Chip variant="warn">Pendente</Chip>
                  )}
                  {s.signUrl && !s.signedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => {
                        navigator.clipboard.writeText(s.signUrl!)
                        toast.success('Link copiado')
                      }}
                    >
                      Link
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {ass.status === 'assinado' && ass.pdfAssinadoUrl && (
            <div className="space-y-2">
              <a
                href={ass.pdfAssinadoUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-accent text-small hover:underline"
              >
                <FileDown className="h-4 w-4" /> Baixar PDF assinado
              </a>
              {ass.pdfAssinadoHash && (
                <p className="text-fg-3 text-tiny font-mono break-all">
                  SHA-256: {ass.pdfAssinadoHash}
                </p>
              )}
            </div>
          )}

          {(ass.status === 'pendente' || ass.status === 'parcial') && (
            <Button
              variant="ghost"
              loading={busy}
              leftIcon={<X className="h-4 w-4" />}
              onClick={cancelar}
              className="text-neg hover:text-neg"
            >
              Cancelar fluxo
            </Button>
          )}
        </div>
      )}

      {openSendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-bg-1 max-w-2xl w-full rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Enviar para assinatura</h3>
            <div className="space-y-3">
              {signatorios.map((s, i) => (
                <div key={i} className="border border-border-1 rounded p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-fg-2 text-small">Signatário {i + 1}</span>
                    {signatorios.length > 1 && (
                      <button onClick={() => rmSig(i)} className="text-neg text-small">
                        remover
                      </button>
                    )}
                  </div>
                  <input
                    placeholder="Nome completo"
                    value={s.name}
                    onChange={(e) => updSig(i, { name: e.target.value })}
                    className="w-full border border-border-1 rounded px-3 py-2 text-small"
                  />
                  <input
                    placeholder="CPF ou CNPJ"
                    value={s.cpfCnpj}
                    onChange={(e) => updSig(i, { cpfCnpj: e.target.value.replace(/\D/g, '') })}
                    className="w-full border border-border-1 rounded px-3 py-2 text-small font-mono"
                  />
                  <input
                    placeholder="E-mail"
                    value={s.email ?? ''}
                    onChange={(e) => updSig(i, { email: e.target.value })}
                    className="w-full border border-border-1 rounded px-3 py-2 text-small"
                  />
                  <select
                    value={s.authMode}
                    onChange={(e) => updSig(i, { authMode: e.target.value as any })}
                    className="w-full border border-border-1 rounded px-3 py-2 text-small"
                  >
                    <option value="simple">Assinatura eletrônica simples</option>
                    <option value="email_token">Token por e-mail</option>
                    <option value="sms">Token por SMS</option>
                    <option value="icp_brasil">Certificado ICP-Brasil</option>
                  </select>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addSig}>
                + Adicionar signatário
              </Button>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setOpenSendModal(false)}>
                Cancelar
              </Button>
              <Button loading={busy} onClick={enviar} leftIcon={<Send className="h-4 w-4" />}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
