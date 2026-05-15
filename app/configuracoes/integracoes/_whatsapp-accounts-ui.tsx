'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  MessageCircle,
  QrCode,
} from 'lucide-react'
import {
  connectWhatsappCentral,
  refreshWhatsappQRCode,
  checkWhatsappStatus,
  disconnectWhatsapp,
} from './_whatsapp-actions-multi'

interface WhatsAccount {
  id: string
  provider: string | null
  displayName: string | null
  identifier: string | null
  config: {
    modo: 'central' | 'byo'
    instanceName: string
    baseUrl: string
    phoneNumber?: string | null
  }
  enabled: boolean
  lastTestedAt: string | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
}

interface Props {
  accounts: WhatsAccount[]
  centralAvailable: boolean
}

const inputCls =
  'w-full px-3 py-2 rounded-md text-sm bg-white/5 border border-white/10 focus:border-accent focus:outline-none'

export function WhatsappAccountsCard({ accounts, centralAvailable }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [active, setActive] = useState<{ id: string; qr: string | null; pairingCode: string | null } | null>(null)

  return (
    <>
      <ul className="space-y-2">
        {accounts.length === 0 && (
          <li className="text-sm opacity-70 py-3">
            Nenhum WhatsApp conectado. Clique em <strong>Conectar WhatsApp</strong> para
            escanear o QR code com o celular.
          </li>
        )}
        {accounts.map((acc) => (
          <WhatsRow
            key={acc.id}
            account={acc}
            onReconnect={(qr, pairingCode) => setActive({ id: acc.id, qr, pairingCode })}
          />
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        {!centralAvailable && (
          <p className="text-[11px]" style={{ color: 'var(--warning)' }}>
            ⚠ Servidor WhatsApp central ainda não foi provisionado. Veja
            infrastructure/evolution-api/README.md.
          </p>
        )}
        {accounts.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            Para conectar um segundo número, primeiro desconecte o atual.
          </p>
        )}
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          disabled={!centralAvailable || accounts.length > 0}
          className="btn primary"
          style={{ fontSize: 12 }}
          title={
            !centralAvailable
              ? 'Servidor central pendente'
              : accounts.length > 0
                ? 'Já existe um WhatsApp conectado (multi-conta WhatsApp em breve)'
                : 'Conectar nova conta'
          }
        >
          <Plus className="w-3.5 h-3.5" />
          Conectar WhatsApp
        </button>
      </div>

      {wizardOpen && (
        <ConnectWizardModal
          onClose={() => setWizardOpen(false)}
          onConnected={() => {
            setWizardOpen(false)
          }}
        />
      )}
      {active && (
        <QRCodeModal
          credentialId={active.id}
          initialQR={active.qr}
          pairingCode={active.pairingCode}
          onClose={() => setActive(null)}
        />
      )}
    </>
  )
}

function WhatsRow({
  account,
  onReconnect,
}: {
  account: WhatsAccount
  onReconnect: (qr: string | null, pairingCode: string | null) => void
}) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const status =
    account.enabled && account.config.phoneNumber
      ? { label: 'Conectada', color: 'var(--success)', icon: CheckCircle2 }
      : { label: 'Não conectada · escaneie o QR', color: 'var(--warning)', icon: AlertCircle }
  const Icon = status.icon

  const handleReconnect = () => {
    startTransition(async () => {
      try {
        const r = await refreshWhatsappQRCode(account.id)
        if (r.qrCodeBase64 || r.pairingCode) {
          onReconnect(r.qrCodeBase64, r.pairingCode)
        } else {
          setFeedback('Não foi possível obter QR code agora. Tente em alguns segundos.')
        }
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Desconectar WhatsApp ${account.config.phoneNumber ?? account.displayName}?`)) return
    startTransition(async () => {
      try {
        await disconnectWhatsapp(account.id)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      }
    })
  }

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: '#25D366', // WhatsApp green
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <MessageCircle className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">
            {account.displayName || 'WhatsApp'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {account.config.modo === 'central' ? 'Servidor BH Grain' : 'Servidor próprio'}
          </span>
        </div>
        <div
          className="flex items-center gap-3 flex-wrap mt-0.5"
          style={{ fontSize: 11, color: 'var(--text-dim)' }}
        >
          {account.config.phoneNumber && (
            <span style={{ color: 'var(--text-mute)' }}>
              +{account.config.phoneNumber}
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: status.color }}>
            <Icon className="w-3 h-3" />
            {status.label}
          </span>
        </div>
        {feedback && (
          <div className="mt-1 text-[11px]" style={{ color: 'var(--text-mute)' }}>
            {feedback}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!account.enabled && (
          <button
            type="button"
            onClick={handleReconnect}
            disabled={pending}
            className="btn ghost"
            style={{ fontSize: 11, padding: '6px 10px' }}
            title="Mostrar QR code novamente"
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
            QR code
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="btn ghost"
          style={{ fontSize: 11, padding: '6px 10px', color: 'var(--danger)' }}
          title="Desconectar"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </li>
  )
}

// ============================================================================
// Modal — nome + cria instância
// ============================================================================

function ConnectWizardModal({
  onClose,
  onConnected,
}: {
  onClose: () => void
  onConnected: () => void
}) {
  const [displayName, setDisplayName] = useState('WhatsApp principal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    credentialId: string
    qrCodeBase64: string | null
    pairingCode: string | null
  } | null>(null)

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await connectWhatsappCentral(displayName)
      setCreated({
        credentialId: r.credentialId,
        qrCodeBase64: r.qrCodeBase64,
        pairingCode: r.pairingCode,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <QRCodeModal
        credentialId={created.credentialId}
        initialQR={created.qrCodeBase64}
        pairingCode={created.pairingCode}
        onClose={() => {
          setCreated(null)
          onConnected()
        }}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Conectar nova conta
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>WhatsApp</h3>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
              Nome de exibição
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Vendas BH"
              maxLength={120}
            />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Aparece na lista de contas e em cada mensagem recebida.
            </p>
          </div>

          <div
            style={{
              padding: 12,
              background: 'var(--accent-soft)',
              border: '1px solid rgba(200,240,81,0.2)',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <strong>Como funciona:</strong>
            <ol className="list-decimal pl-5 mt-1 space-y-0.5" style={{ fontSize: 11 }}>
              <li>Após clicar em Continuar, mostramos um QR code.</li>
              <li>No seu celular, abra o WhatsApp → Configurações → Dispositivos conectados.</li>
              <li>Toque em <em>Conectar dispositivo</em> e escaneie o QR.</li>
              <li>Pronto — mensagens recebidas aparecerão no seu Inbox unificado.</li>
            </ol>
          </div>

          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <footer
          className="px-5 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button type="button" onClick={onClose} disabled={busy} className="btn ghost" style={{ fontSize: 12 }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !displayName.trim()}
            className="btn primary"
            style={{ fontSize: 12 }}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {busy ? 'Criando instância…' : 'Continuar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ============================================================================
// Modal QR Code com polling
// ============================================================================

function QRCodeModal({
  credentialId,
  initialQR,
  pairingCode,
  onClose,
}: {
  credentialId: string
  initialQR: string | null
  pairingCode: string | null
  onClose: () => void
}) {
  const [qr, setQr] = useState<string | null>(initialQR)
  const [pCode, setPCode] = useState<string | null>(pairingCode)
  const [status, setStatus] = useState<string>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling de status a cada 2s (até conectar)
  useEffect(() => {
    let cancel = false
    const tick = async () => {
      try {
        const r = await checkWhatsappStatus(credentialId)
        if (cancel) return
        setStatus(r.status)
        if (r.status === 'open' || r.enabled) {
          setConnected(true)
          if (pollRef.current) clearInterval(pollRef.current)
          if (refreshRef.current) clearInterval(refreshRef.current)
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Erro')
      }
    }
    tick()
    pollRef.current = setInterval(tick, 2000)

    // QR code do Evolution expira a cada ~30s — refresh automático
    const refreshTick = async () => {
      if (cancel || connected) return
      try {
        const r = await refreshWhatsappQRCode(credentialId)
        if (cancel) return
        if (r.qrCodeBase64) setQr(r.qrCodeBase64)
        if (r.pairingCode) setPCode(r.pairingCode)
      } catch {
        /* silencioso */
      }
    }
    refreshRef.current = setInterval(refreshTick, 25_000)

    return () => {
      cancel = true
      if (pollRef.current) clearInterval(pollRef.current)
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [credentialId, connected])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Conectar WhatsApp
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {connected ? 'Conectado!' : 'Escaneie o QR Code'}
          </h3>
        </header>

        <div className="p-5">
          {connected ? (
            <div className="text-center py-6">
              <CheckCircle2
                className="mx-auto"
                style={{ width: 64, height: 64, color: 'var(--success)' }}
              />
              <p className="mt-3 font-semibold">WhatsApp conectado com sucesso.</p>
              <p className="mt-1 text-sm opacity-70">
                Mensagens recebidas agora chegam no seu Inbox.
              </p>
            </div>
          ) : qr ? (
            <div className="text-center">
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code WhatsApp"
                style={{
                  width: 280,
                  height: 280,
                  display: 'block',
                  margin: '0 auto',
                  background: '#fff',
                  borderRadius: 12,
                  padding: 12,
                }}
              />
              <p className="mt-3 text-sm" style={{ color: 'var(--text-mute)' }}>
                Abra o WhatsApp no celular → <strong>Configurações</strong> →
                <strong> Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong>
              </p>
              {pCode && (
                <div
                  className="mt-3 inline-block"
                  style={{
                    padding: '8px 16px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontFamily: 'var(--f-mono)',
                    fontSize: 18,
                    letterSpacing: '0.1em',
                  }}
                >
                  {pCode}
                </div>
              )}
              <p className="mt-2 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                QR atualiza automaticamente · Status: {status}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="mx-auto w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="mt-3 text-sm opacity-70">Gerando QR code…</p>
            </div>
          )}

          {error && (
            <div
              className="mt-3"
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <footer
          className="px-5 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button type="button" onClick={onClose} className="btn primary" style={{ fontSize: 12 }}>
            {connected ? 'Concluir' : 'Fechar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
