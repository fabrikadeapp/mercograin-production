'use client'

import * as React from 'react'
import {
  Smartphone,
  LogOut,
  Phone,
  Send,
  Lock,
  RefreshCw,
  MoreHorizontal,
  WifiOff,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Input,
  Chip,
  IconButton,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

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

interface MessageRow {
  id: string
  number: string
  text: string
  messageId: string | null
  status: 'recebido' | 'processado' | 'erro' | string
  mensagem: string | null
  timestamp: string
}

const STATUS_CHIP: Record<MessageRow['status'], 'pos' | 'warn' | 'neg' | 'neutral'> = {
  processado: 'pos',
  erro: 'neg',
  recebido: 'warn',
} as Record<string, any>

function statusLabel(s: ConnState): string {
  if (s === 'open') return 'Conectado'
  if (s === 'connecting') return 'Conectando…'
  if (s === 'close') return 'Desconectado'
  return 'Indeterminado'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function WhatsAppContent() {
  const toast = useToast()
  const [conn, setConn] = React.useState<ConnectResponse | null>(null)
  const [loadingConn, setLoadingConn] = React.useState(true)
  const [refreshingQR, setRefreshingQR] = React.useState(false)
  const [qrUpdatedAt, setQrUpdatedAt] = React.useState<number | null>(null)
  const [qrAgeSec, setQrAgeSec] = React.useState(0)
  const [number, setNumber] = React.useState('')
  const [text, setText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [messages, setMessages] = React.useState<MessageRow[]>([])

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
      /* swallow — UI stays in last known state */
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
    } catch (e) {
      toast.error('Erro ao gerar QR Code')
    } finally {
      setRefreshingQR(false)
    }
  }, [toast])

  const fetchMessages = React.useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/messages?limit=50', {
        cache: 'no-store',
      })
      if (!r.ok) return
      const d = await r.json()
      // Mapeia novo shape (WhatsAppMessage) para o MessageRow legado da UI.
      // Status backend (delivered|sent|read|pending|failed) → UI (processado|recebido|erro).
      const mapped: MessageRow[] = (d.data ?? []).map((m: any) => {
        const number = String(m.remoteJid || '').split('@')[0] || ''
        let uiStatus: MessageRow['status'] = 'processado'
        if (m.status === 'failed') uiStatus = 'erro'
        else if (m.status === 'pending') uiStatus = 'recebido'
        else if (m.fromMe === false) uiStatus = 'recebido'
        return {
          id: m.id,
          number,
          text: m.text ?? (m.mediaCaption ?? (m.mediaType ? `[${m.mediaType}]` : '')),
          messageId: m.messageId ?? null,
          status: uiStatus,
          mensagem: null,
          timestamp: m.timestamp,
        }
      })
      setMessages(mapped)
    } catch {
      /* ignore */
    }
  }, [])

  // Initial load
  React.useEffect(() => {
    ;(async () => {
      setLoadingConn(true)
      await fetchConnect()
      await fetchMessages()
      setLoadingConn(false)
    })()
  }, [fetchConnect, fetchMessages])

  // Poll status every 3s while not connected
  React.useEffect(() => {
    if (isConnected) return
    const id = setInterval(() => {
      fetchStatus()
    }, 3000)
    return () => clearInterval(id)
  }, [isConnected, fetchStatus])

  // Auto-refresh QR a cada 30s enquanto não conectado (QR do WhatsApp expira ~40s).
  React.useEffect(() => {
    if (isConnected) return
    const id = setInterval(() => {
      fetchConnect()
    }, 30_000)
    return () => clearInterval(id)
  }, [isConnected, fetchConnect])

  // Tick de 1s pra atualizar o "QR atualizado há Xs".
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

  // When state flips to connected, refresh once to pull profile info & clear QR
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!number.trim() || !text.trim()) {
      toast.error('Preencha número e mensagem')
      return
    }
    setSending(true)
    try {
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number.trim(), text }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d?.error || 'Erro ao enviar')
        return
      }
      toast.success(`Mensagem enviada (${d.messageId})`)
      setText('')
      fetchMessages()
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const messageColumns: DenseTableColumn<MessageRow>[] = [
    {
      key: 'time',
      header: 'Hora',
      accessor: (r) => (
        <span className="text-fg-2 t-num">{formatTime(r.timestamp)}</span>
      ),
      width: '90px',
    },
    {
      key: 'number',
      header: 'Número',
      accessor: (r) => <span className="t-num">{r.number}</span>,
      width: '160px',
    },
    {
      key: 'text',
      header: 'Mensagem',
      accessor: (r) => (
        <span className="text-fg-2 truncate block max-w-[360px]" title={r.text}>
          {r.text}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => (
        <Chip variant={STATUS_CHIP[r.status] ?? 'neutral'}>
          {r.status === 'processado'
            ? 'Enviado'
            : r.status === 'erro'
              ? 'Falha'
              : 'Pendente'}
        </Chip>
      ),
      width: '120px',
    },
    {
      key: 'action',
      header: '',
      accessor: () => (
        <IconButton aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      ),
      align: 'right',
      width: '60px',
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna esquerda: Conexão */}
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
            ) : isConnected ? (
              <div className="space-y-4 text-center">
                {conn?.profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conn.profilePicUrl}
                    alt={conn.profileName ?? 'Perfil WhatsApp'}
                    className="mx-auto h-16 w-16 rounded-pill border border-border-1 object-cover"
                  />
                ) : (
                  <div className="mx-auto h-16 w-16 rounded-pill bg-bg-2 border border-border-1 flex items-center justify-center">
                    <Smartphone className="h-7 w-7 text-accent" />
                  </div>
                )}
                <div>
                  <p className="text-fg-1 font-semibold">Conectado</p>
                  {conn?.profileName ? (
                    <p className="text-fg-2 text-small mt-1">
                      {conn.profileName}
                    </p>
                  ) : null}
                  {conn?.phoneNumber || conn?.ownerJid ? (
                    <p className="text-fg-3 text-micro t-num mt-0.5">
                      {conn.phoneNumber ?? conn.ownerJid?.split('@')[0]}
                    </p>
                  ) : null}
                  {conn?.instanceName ? (
                    <p className="text-fg-3 text-micro mt-0.5">
                      Instância: <span className="t-num">{conn.instanceName}</span>
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  leftIcon={<LogOut className="h-4 w-4" />}
                  onClick={handleDisconnect}
                >
                  Desconectar
                </Button>
              </div>
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
                    <p className="text-fg-3 text-small">Gerando QR Code...</p>
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

      {/* Coluna direita: Envio + histórico */}
      <div className="lg:col-span-2 space-y-6 relative">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Mensagens">Enviar mensagem</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSend} className="space-y-4">
              <Input
                label="Número (com DDI)"
                placeholder="5511999999999"
                leftIcon={<Phone className="h-4 w-4 text-fg-3" />}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                disabled={!isConnected}
              />
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow" htmlFor="wa-text">
                  Mensagem
                </label>
                <textarea
                  id="wa-text"
                  className="min-h-32 w-full rounded-md border border-border-1 bg-bg-2 p-3 text-fg-1 text-small placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Olá! Tudo bem? 👋"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={4096}
                  disabled={!isConnected}
                />
                <div className="flex justify-end">
                  <span className="text-fg-3 text-micro t-num">
                    {text.length}/4096
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={sending}
                  leftIcon={<Send className="h-4 w-4" />}
                  disabled={!isConnected}
                >
                  Enviar
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle eyebrow="Histórico">Mensagens recentes</CardTitle>
          </CardHeader>
          <CardBody>
            <DenseTable
              columns={messageColumns}
              rows={messages}
              rowKey={(r) => r.id}
              empty={
                <div className="space-y-1">
                  <p className="text-fg-2">Nenhuma mensagem enviada ainda</p>
                  <p className="text-fg-3 text-micro">
                    Os envios aparecerão aqui em tempo real.
                  </p>
                </div>
              }
            />
          </CardBody>
        </Card>

        {!isConnected && !loadingConn ? (
          <div className="absolute inset-0 rounded-md bg-bg-1/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="card text-center space-y-2 px-8 py-6 pointer-events-auto">
              <Lock className="h-6 w-6 text-fg-3 mx-auto" />
              <p className="text-fg-1 font-semibold">
                Conecte o WhatsApp para enviar mensagens
              </p>
              <p className="text-fg-3 text-small">
                Escaneie o QR Code ao lado para iniciar a sessão.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Sub-export for icon used in disconnected pill (fallback if needed elsewhere)
export const WhatsAppOfflineIcon = WifiOff
