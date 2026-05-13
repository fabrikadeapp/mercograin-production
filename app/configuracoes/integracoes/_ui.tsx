'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertTriangle, Trash2, ExternalLink } from 'lucide-react'
import {
  saveEmail,
  testEmail,
  saveInstagram,
  testInstagramAction,
  saveWhatsapp,
  testWhatsappAction,
  deleteChannel,
} from './_actions'
import { ConfirmModal } from './_ConfirmModal'

interface CredView<C> {
  config: C
  hasSecrets: string[]
  enabled: boolean
  lastTestedAt: string | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
}

function inputCls(): string {
  return 'w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm'
}

function TestStatus({ cred }: { cred: { lastTestedAt: string | null; lastTestSuccess: boolean | null; lastTestError: string | null } | null }) {
  if (!cred?.lastTestedAt) return null
  const success = cred.lastTestSuccess
  return (
    <div
      className="text-xs mt-2 flex items-start gap-1.5"
      style={{ color: success ? 'var(--vg-success, #10b981)' : '#f59e0b' }}
    >
      {success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
      <div>
        <div className="font-medium">
          Último teste {success ? 'OK' : 'FALHOU'} · {new Date(cred.lastTestedAt).toLocaleString('pt-BR')}
        </div>
        {!success && cred.lastTestError && (
          <div className="text-vg-fg-3 mt-0.5 break-words">{cred.lastTestError}</div>
        )}
      </div>
    </div>
  )
}

function SubmitButtons({ saving, onSave, onTest, hasSecrets }: { saving: boolean; onSave: () => void; onTest: () => void; hasSecrets: boolean }) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-3 py-1.5 disabled:opacity-50"
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={onTest}
        disabled={saving || !hasSecrets}
        title={!hasSecrets ? 'Salve as credenciais primeiro' : ''}
        className="bg-white/10 hover:bg-white/15 text-sm rounded px-3 py-1.5 disabled:opacity-40"
      >
        {saving ? 'Testando…' : 'Testar conexão'}
      </button>
    </div>
  )
}

// ============================================================================
// EMAIL FORM
// ============================================================================

interface EmailConfig {
  imapHost: string
  imapPort: number
  imapUser: string
  imapTls: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpTls: boolean
  fromName?: string | null
  fromEmail?: string | null
}

export function EmailForm({ initial }: { initial: CredView<EmailConfig> | null }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const cfg = initial?.config

  return (
    <form
      action={(fd) => {
        setError(null)
        startTransition(async () => {
          try {
            await saveEmail(fd)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro')
          }
        })
      }}
      className="space-y-2"
    >
      <fieldset className="border border-white/10 rounded p-3">
        <legend className="px-2 text-xs uppercase tracking-wider opacity-70">IMAP (leitura)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input name="imapHost" defaultValue={cfg?.imapHost ?? ''} placeholder="imap.gmail.com" className={inputCls()} required />
          <input name="imapPort" type="number" defaultValue={cfg?.imapPort ?? 993} placeholder="993" className={inputCls()} required />
          <input name="imapUser" defaultValue={cfg?.imapUser ?? ''} placeholder="seu@email.com" className={`${inputCls()} col-span-2`} required />
          <input
            name="imapPassword"
            type="password"
            placeholder={initial?.hasSecrets.includes('imapPassword') ? '••••••• (deixe em branco para manter)' : 'Senha IMAP'}
            className={`${inputCls()} col-span-2`}
            autoComplete="new-password"
          />
          <label className="flex items-center gap-2 col-span-2 text-xs">
            <input name="imapTls" type="checkbox" defaultChecked={cfg?.imapTls ?? true} />
            Usar TLS/SSL (recomendado)
          </label>
        </div>
      </fieldset>

      <fieldset className="border border-white/10 rounded p-3">
        <legend className="px-2 text-xs uppercase tracking-wider opacity-70">SMTP (envio)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input name="smtpHost" defaultValue={cfg?.smtpHost ?? ''} placeholder="smtp.gmail.com" className={inputCls()} required />
          <input name="smtpPort" type="number" defaultValue={cfg?.smtpPort ?? 587} placeholder="587" className={inputCls()} required />
          <input name="smtpUser" defaultValue={cfg?.smtpUser ?? ''} placeholder="seu@email.com" className={`${inputCls()} col-span-2`} required />
          <input
            name="smtpPassword"
            type="password"
            placeholder={initial?.hasSecrets.includes('smtpPassword') ? '••••••• (deixe em branco para manter)' : 'Senha SMTP'}
            className={`${inputCls()} col-span-2`}
            autoComplete="new-password"
          />
          <label className="flex items-center gap-2 col-span-2 text-xs">
            <input name="smtpTls" type="checkbox" defaultChecked={cfg?.smtpTls ?? true} />
            Usar TLS/SSL
          </label>
        </div>
      </fieldset>

      <fieldset className="border border-white/10 rounded p-3">
        <legend className="px-2 text-xs uppercase tracking-wider opacity-70">Identidade (opcional)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input name="fromName" defaultValue={cfg?.fromName ?? ''} placeholder="Nome remetente" className={inputCls()} />
          <input name="fromEmail" defaultValue={cfg?.fromEmail ?? ''} placeholder="reply-to@dominio.com" className={inputCls()} />
        </div>
      </fieldset>

      {error && (
        <div className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
      <TestStatus cred={initial} />

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-3 py-1.5 disabled:opacity-50">
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={pending || !initial?.hasSecrets.includes('imapPassword') || !initial?.hasSecrets.includes('smtpPassword')}
          title={!initial?.hasSecrets.includes('imapPassword') ? 'Salve as senhas primeiro' : ''}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                await testEmail(new FormData())
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Erro')
              }
            })
          }}
          className="bg-white/10 hover:bg-white/15 text-sm rounded px-3 py-1.5 disabled:opacity-40"
        >
          Testar conexão
        </button>
      </div>

      <details className="text-xs opacity-70 mt-3">
        <summary className="cursor-pointer hover:opacity-100">Como configurar Gmail/Outlook?</summary>
        <div className="mt-2 space-y-1 pl-2">
          <p><strong>Gmail:</strong> ative 2FA, gere uma <a className="underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Senha de App</a> e use ela no campo Senha. IMAP: imap.gmail.com:993 TLS · SMTP: smtp.gmail.com:587 TLS.</p>
          <p><strong>Outlook/Office 365:</strong> IMAP: outlook.office365.com:993 · SMTP: smtp.office365.com:587. Pode exigir senha de app.</p>
          <p><strong>Servidor próprio:</strong> peça ao seu provedor host/porta IMAP+SMTP.</p>
        </div>
      </details>
    </form>
  )
}

// ============================================================================
// INSTAGRAM FORM
// ============================================================================

interface InstagramConfig {
  pageId: string
  instagramBusinessId?: string | null
  pageName?: string | null
}

export function InstagramForm({ initial }: { initial: CredView<InstagramConfig> | null }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const cfg = initial?.config

  return (
    <form
      action={(fd) => {
        setError(null)
        startTransition(async () => {
          try {
            await saveInstagram(fd)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro')
          }
        })
      }}
      className="space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <input name="pageId" defaultValue={cfg?.pageId ?? ''} placeholder="Page ID (numérico)" className={inputCls()} required />
        <input name="instagramBusinessId" defaultValue={cfg?.instagramBusinessId ?? ''} placeholder="Instagram Business ID (opcional)" className={inputCls()} />
        <input name="pageName" defaultValue={cfg?.pageName ?? ''} placeholder="Nome da página (display)" className={`${inputCls()} col-span-2`} />
        <input
          name="pageAccessToken"
          type="password"
          placeholder={initial?.hasSecrets.includes('pageAccessToken') ? '••••••• Page Access Token (deixe em branco para manter)' : 'Page Access Token'}
          className={`${inputCls()} col-span-2`}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
      <TestStatus cred={initial} />

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-3 py-1.5 disabled:opacity-50">
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={pending || !initial?.hasSecrets.includes('pageAccessToken')}
          title={!initial?.hasSecrets.includes('pageAccessToken') ? 'Salve o token primeiro' : ''}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                await testInstagramAction()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Erro')
              }
            })
          }}
          className="bg-white/10 hover:bg-white/15 text-sm rounded px-3 py-1.5 disabled:opacity-40"
        >
          Testar conexão
        </button>
      </div>

      <details className="text-xs opacity-70 mt-3">
        <summary className="cursor-pointer hover:opacity-100">Como obter o Page Access Token?</summary>
        <ol className="mt-2 space-y-1 pl-5 list-decimal">
          <li>Sua conta Instagram precisa ser <strong>Business</strong> ou <strong>Creator</strong> e estar vinculada a uma página Facebook.</li>
          <li>Acesse <a className="underline inline-flex items-center gap-1" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer <ExternalLink className="w-3 h-3" /></a>.</li>
          <li>Selecione sua App, depois "User Token" → "Get Page Access Token".</li>
          <li>Permissões necessárias: <code>pages_messaging</code>, <code>instagram_basic</code>, <code>instagram_manage_messages</code>.</li>
          <li>Para token de longa duração, troque o User Token via <code>fb_exchange_token</code> e depois pegue o Page Token (que herda a duração).</li>
          <li>Cole o Page Access Token aqui. Nunca pedimos sua senha.</li>
        </ol>
        <p className="mt-2 text-amber-400">⚠ Armazenar senha pessoal do Instagram viola os Termos do Meta e pode resultar em suspensão da conta. Por isso usamos token oficial.</p>
      </details>
    </form>
  )
}

// ============================================================================
// WHATSAPP FORM
// ============================================================================

interface WhatsappConfig {
  modo: 'central' | 'byo'
  instanceName: string
  baseUrl: string
  phoneNumber?: string | null
}

export function WhatsappForm({
  initial,
  mode,
  centralBaseUrl,
}: {
  initial: CredView<WhatsappConfig> | null
  mode: 'central' | 'byo' | 'hybrid'
  centralBaseUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [modoSelecionado, setModoSelecionado] = useState<'central' | 'byo'>(
    initial?.config.modo ?? (mode === 'byo' ? 'byo' : 'central')
  )
  const cfg = initial?.config

  const showModoToggle = mode === 'hybrid'
  const isByo = mode === 'byo' || (mode === 'hybrid' && modoSelecionado === 'byo')

  return (
    <form
      action={(fd) => {
        setError(null)
        startTransition(async () => {
          try {
            await saveWhatsapp(fd)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro')
          }
        })
      }}
      className="space-y-2"
    >
      {showModoToggle && (
        <div className="flex gap-2 mb-2">
          <label className="flex items-center gap-2 text-xs flex-1 bg-black/20 rounded p-2 cursor-pointer">
            <input
              type="radio"
              name="modo"
              value="central"
              checked={modoSelecionado === 'central'}
              onChange={() => setModoSelecionado('central')}
            />
            <div>
              <div className="font-semibold">Central (recomendado)</div>
              <div className="opacity-70">Servidor BH Grain provisiona automaticamente. Conecte via QR code.</div>
            </div>
          </label>
          <label className="flex items-center gap-2 text-xs flex-1 bg-black/20 rounded p-2 cursor-pointer">
            <input
              type="radio"
              name="modo"
              value="byo"
              checked={modoSelecionado === 'byo'}
              onChange={() => setModoSelecionado('byo')}
            />
            <div>
              <div className="font-semibold">BYO (Bring Your Own)</div>
              <div className="opacity-70">Você roda Evolution próprio e fornece URL + API Key.</div>
            </div>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {isByo ? (
          <input
            name="baseUrl"
            defaultValue={cfg?.baseUrl ?? ''}
            placeholder="https://evolution.seudominio.com"
            className={`${inputCls()} col-span-2`}
            required
          />
        ) : (
          <div className="col-span-2 text-xs opacity-70 bg-black/10 rounded p-2">
            Servidor central: <code>{centralBaseUrl ?? 'não configurado'}</code>
          </div>
        )}
        <input
          name="instanceName"
          defaultValue={cfg?.instanceName ?? ''}
          placeholder={isByo ? 'Nome da instância' : 'Nome da instância (auto)'}
          className={inputCls()}
        />
        <input
          name="phoneNumber"
          defaultValue={cfg?.phoneNumber ?? ''}
          placeholder="Telefone conectado (preenchido após pareamento)"
          className={inputCls()}
        />
        <input
          name="apiKey"
          type="password"
          placeholder={initial?.hasSecrets.includes('apiKey') ? '••••••• apiKey (deixe em branco para manter)' : 'apiKey do Evolution'}
          className={`${inputCls()} col-span-2`}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
      <TestStatus cred={initial} />

      <div className="flex gap-2 pt-2 flex-wrap">
        <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-3 py-1.5 disabled:opacity-50">
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={pending || !initial?.hasSecrets.includes('apiKey')}
          title={!initial?.hasSecrets.includes('apiKey') ? 'Salve a apiKey primeiro' : ''}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                await testWhatsappAction()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Erro')
              }
            })
          }}
          className="bg-white/10 hover:bg-white/15 text-sm rounded px-3 py-1.5 disabled:opacity-40"
        >
          Testar conexão
        </button>
        {!isByo && (
          <ProvisionarCentralButton onProvisioned={() => window.location.reload()} />
        )}
      </div>

      <details className="text-xs opacity-70 mt-3">
        <summary className="cursor-pointer hover:opacity-100">Como conectar o WhatsApp?</summary>
        <div className="mt-2 space-y-1 pl-2">
          <p><strong>Modo central:</strong> após salvar, vá para <code>/whatsapp</code> e escaneie o QR code com seu celular (WhatsApp → Configurações → Dispositivos conectados).</p>
          <p><strong>Modo BYO:</strong> rode o Evolution API em seu próprio servidor (Docker/Railway). Pegue a URL pública + apiKey definida em <code>AUTHENTICATION_API_KEY</code> e cole aqui.</p>
          <p>Documentação Evolution: <a className="underline" href="https://doc.evolution-api.com/" target="_blank" rel="noreferrer">doc.evolution-api.com</a></p>
        </div>
      </details>
    </form>
  )
}

// ============================================================================
// DELETE BUTTON
// ============================================================================

const DELETE_CHANNEL_LABEL: Record<string, string> = {
  email_imap_smtp: 'E-mail (IMAP + SMTP)',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
}

export function DeleteChannelButton({ channel }: { channel: 'email_imap_smtp' | 'instagram' | 'whatsapp' }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    const fd = new FormData()
    fd.set('channel', channel)
    startTransition(async () => {
      try {
        await deleteChannel(fd)
      } finally {
        setOpen(false)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
      >
        <Trash2 className="w-3 h-3" /> {pending ? 'Removendo…' : 'Remover credenciais'}
      </button>
      <ConfirmModal
        open={open}
        onCancel={() => !pending && setOpen(false)}
        onConfirm={handleConfirm}
        title={`Remover credenciais de ${DELETE_CHANNEL_LABEL[channel] ?? channel}?`}
        description="A senha/token criptografado e todas as configurações deste canal serão apagados deste workspace. Esta ação não pode ser desfeita. Você precisará cadastrar tudo novamente para reconectar."
        confirmLabel="Remover definitivamente"
        destructive
        busy={pending}
      />
    </>
  )
}

function ProvisionarCentralButton({ onProvisioned }: { onProvisioned: () => void }) {
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function provision() {
    setPending(true)
    setMsg(null)
    setErr(null)
    try {
      const res = await fetch('/api/bhgrain/integracoes/whatsapp/provision', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        instanceName?: string
        status?: string
        qrCodeUrl?: string
        error?: string
      }
      if (!res.ok) {
        setErr(data.error ?? `HTTP ${res.status}`)
        return
      }
      setMsg(`Instância "${data.instanceName}" provisionada (status: ${data.status}). Acesse ${data.qrCodeUrl ?? '/whatsapp'} para parear via QR code.`)
      setTimeout(onProvisioned, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={provision}
        disabled={pending}
        className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? 'Provisionando…' : 'Provisionar instância central'}
      </button>
      {(msg || err) && (
        <div
          className="text-xs w-full mt-2"
          style={{ color: err ? 'var(--vg-destructive, #ef4444)' : 'var(--vg-success, #10b981)' }}
        >
          {err ?? msg}
        </div>
      )}
    </>
  )
}
