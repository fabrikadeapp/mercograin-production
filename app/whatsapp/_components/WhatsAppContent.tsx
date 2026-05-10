'use client'

import * as React from 'react'
import {
  Smartphone,
  LogOut,
  Lock,
  RefreshCw,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { InboxLayout } from './InboxLayout'

type ConnState = 'open' | 'connecting' | 'close' | 'unknown'

interface StatusResponse {
  status: ConnState
  ownerJid: string | null
  profileName: string | null
  profilePicUrl?: string | null
  phoneNumber?: string | null
  instanceName?: string | null
  provisioned?: boolean
}

interface ConnectResponse {
  status: ConnState
  qrCode: string | null
  pairingCode: string | null
  alreadyConnected: boolean
  ownerJid: string | null
  profileName: string | null
  profilePicUrl?: string | null
  phoneNumber?: string | null
  instanceName?: string | null
}

function statusLabel(s: ConnState): string {
  if (s === 'open') return 'Conectado'
  if (s === 'connecting') return 'Conectando…'
  if (s === 'close') return 'Desconectado'
  return 'Indeterminado'
}

export function WhatsAppContent() {
  const toast = useToast()
  const [conn, setConn] = React.useState<ConnectResponse | null>(null)
  const [loadingConn, setLoadingConn] = React.useState(true)
  const [refreshingQR, setRefreshingQR] = React.useState(false)
  const [qrUpdatedAt, setQrUpdatedAt] = React.useState<number | null>(null)
  const [qrAgeSec, setQrAgeSec] = React.useState(0)

  const isConnected = conn?.status === 'open'

  const fetchStatus = React.useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/status', { cache: 'no-store' })
      if (!r.ok) return
      const d: StatusResponse = await r.json()
      setConn((prev) => ({
        status: d.status,
        qrCode: prev?.qrCode ?? null,
        pairingCode: prev?.pairingCode ?? null,
        alreadyConnected: d.status === 'open',
        ownerJid: d.ownerJid,
        profileName: d.profileName,
        profilePicUrl: d.profilePicUrl ?? null,
        phoneNumber: d.phoneNumber ?? null,
        instanceName: d.instanceName ?? prev?.instanceName ?? null,
      }))
    } catch {
      /* swallow */
    }
  }, [])

  const fetchConnect = React.useCallback(async () => {
    setRefreshingQR(true)
    try {
      const r = await fetch('/api/whatsapp/connect', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d?.error || 'Erro ao gerar QR Code')
        return
      }
      setConn(d)
      if (d?.qrCode) setQrUpdatedAt(Date.now())
    } catch {
      toast.error('Erro ao gerar QR Code')
    } finally {
      setRefreshingQR(false)
    }
  }, [toast])

  React.useEffect(() => {
    ;(async () => {
      setLoadingConn(true)
      await fetchConnect()
      setLoadingConn(false)
    })()
  }, [fetchConnect])

  // Poll status every 3s while not connected
  React.useEffect(() => {
    if (isConnected) return
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [isConnected, fetchStatus])

  // Auto-refresh QR every 30s while not connected
  React.useEffect(() => {
    if (isConnected) return
    const id = setInterval(fetchConnect, 30_000)
    return () => clearInterval(id)
  }, [isConnected, fetchConnect])

  // 1s tick para "QR atualizado há Xs"
  React.useEffect(() => {
    if (isConnected || !qrUpdatedAt) {
      setQrAgeSec(0)
      return
    }
    const id = setInterval(() => {
      setQrAgeSec(Math.floor((Date.now() - qrUpdatedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [isConnected, qrUpdatedAt])

  // Quando conecta, refresh para puxar profile
  React.useEffect(() => {
    if (isConnected && !conn?.profileName) {
      fetchStatus()
    }
  }, [isConnected, conn?.profileName, fetchStatus])

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp da instance Evolution?')) return
    try {
      const r = await fetch('/api/whatsapp/disconnect', { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d?.error || 'Erro ao desconectar')
        return
      }
      toast.success('WhatsApp desconectado')
      await fetchConnect()
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-md border border-border-1 bg-bg-1">
          <div className="flex items-center gap-3 min-w-0">
            {conn?.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={conn.profilePicUrl}
                alt={conn.profileName ?? 'Perfil'}
                className="h-10 w-10 rounded-pill border border-border-2 object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-pill bg-bg-2 border border-border-1 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-accent" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-fg-1 font-semibold text-small truncate">
                {conn?.profileName ?? 'Conectado'}
              </p>
              <p className="text-fg-3 text-micro t-num truncate">
                {conn?.phoneNumber ?? conn?.ownerJid?.split('@')[0] ?? '—'}
                {conn?.instanceName ? ` · ${conn.instanceName}` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={handleDisconnect}
          >
            Desconectar
          </Button>
        </div>

        <InboxLayout enabled={isConnected} />
      </div>
    )
  }

  // Estado desconectado: card de QR/pareamento
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Conexão">Estado da instance</CardTitle>
          </CardHeader>
          <CardBody>
            {loadingConn ? (
              <p className="text-fg-3 text-small text-center py-8">
                Carregando…
              </p>
            ) : (
              <div className="space-y-4 text-center">
                {conn?.qrCode ? (
                  <div>
                    <div className="rounded-md border border-border-1 bg-bg-1 p-3 inline-block mx-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={conn.qrCode}
                        alt="QR Code WhatsApp"
                        className="h-56 w-56 mx-auto"
                      />
                    </div>
                    {qrUpdatedAt ? (
                      <p className="text-fg-3 text-micro mt-2">
                        QR atualizado há {qrAgeSec}s · renova a cada 30s
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="h-56 w-56 mx-auto rounded-md border border-dashed border-border-2 bg-bg-2 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 text-fg-3 animate-spin" />
                    <p className="text-fg-3 text-small">Gerando QR Code…</p>
                  </div>
                )}
                <div>
                  <p className="text-fg-1 font-semibold">
                    {statusLabel(conn?.status ?? 'unknown')}
                  </p>
                  <p className="text-fg-3 text-small mt-1">
                    Escaneie o QR com o WhatsApp do celular (Configurações →
                    Aparelhos conectados).
                  </p>
                </div>
                {conn?.pairingCode ? (
                  <p className="text-fg-2 text-small">
                    Código de pareamento:{' '}
                    <span className="t-num font-semibold">
                      {conn.pairingCode}
                    </span>
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  fullWidth
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={fetchConnect}
                  loading={refreshingQR}
                >
                  Atualizar QR
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Inbox">WhatsApp Inbox</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-2">
              <Lock className="h-7 w-7 text-fg-3" />
              <p className="text-fg-1 font-semibold">
                Conecte o WhatsApp para começar
              </p>
              <p className="text-fg-3 text-small max-w-md">
                Após conectar, todas as conversas recebidas aparecerão aqui em
                tempo real. Você poderá responder direto pelo painel.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
