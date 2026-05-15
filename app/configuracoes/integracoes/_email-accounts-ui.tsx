'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, Loader2, Plus, Trash2, RefreshCw, Mail, ExternalLink } from 'lucide-react'
import {
  testEmailDraft,
  createEmail,
  updateEmail,
  deleteEmail,
  testEmailSaved,
  toggleEmail,
  type TestResultLine,
} from './_email-actions-multi'
import {
  EMAIL_PROVIDERS,
  EMAIL_PROVIDERS_LIST,
  detectProviderByEmail,
  applyProviderDefaults,
  type EmailProviderId,
  type EmailProviderPreset,
} from '@/lib/bhgrain/email-providers'

interface EmailAccount {
  id: string
  provider: string | null
  displayName: string | null
  identifier: string | null
  config: {
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
  enabled: boolean
  lastTestedAt: string | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
  hasSecrets: string[]
  updatedAt: string
}

interface Props {
  accounts: EmailAccount[]
}

const inputCls =
  'w-full px-3 py-2 rounded-md text-sm bg-white/5 border border-white/10 focus:border-accent focus:outline-none transition'

export function EmailAccountsCard({ accounts }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<EmailAccount | null>(null)

  return (
    <>
      {/* Lista de contas */}
      <ul className="space-y-2">
        {accounts.length === 0 && (
          <li className="text-sm opacity-70 py-3">
            Nenhuma conta de e-mail conectada. Clique em <strong>Adicionar e-mail</strong> para começar.
          </li>
        )}
        {accounts.map((acc) => (
          <AccountRow key={acc.id} account={acc} onEdit={() => setEditing(acc)} />
        ))}
      </ul>

      {/* Botão adicionar */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setWizardOpen(true)
          }}
          className="btn primary"
          style={{ fontSize: 12 }}
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar e-mail
        </button>
      </div>

      {/* Wizard modal */}
      {(wizardOpen || editing) && (
        <EmailWizardModal
          editing={editing}
          onClose={() => {
            setWizardOpen(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

// ============================================================================
// Linha da conta
// ============================================================================

function AccountRow({ account, onEdit }: { account: EmailAccount; onEdit: () => void }) {
  const [busy, setBusy] = useState<null | 'test' | 'delete' | 'toggle'>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const preset = (account.provider && EMAIL_PROVIDERS[account.provider as EmailProviderId]) || EMAIL_PROVIDERS.custom
  const status = account.lastTestSuccess === true && account.enabled
    ? { label: 'Conectada', color: 'var(--success)', icon: CheckCircle2 }
    : account.lastTestSuccess === false
      ? { label: 'Falha', color: 'var(--danger)', icon: AlertCircle }
      : { label: 'Não testada', color: 'var(--warning)', icon: AlertCircle }

  const Icon = status.icon
  const lastSync =
    account.lastTestedAt
      ? new Date(account.lastTestedAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  const handleTest = () => {
    setBusy('test')
    setFeedback(null)
    startTransition(async () => {
      try {
        const r = await testEmailSaved(account.id)
        setFeedback(r.ok ? `OK · IMAP ${r.imap.latencyMs ?? 0}ms · SMTP ${r.smtp.latencyMs ?? 0}ms` : `Erro · ${r.imap.message} · ${r.smtp.message}`)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      } finally {
        setBusy(null)
      }
    })
  }

  const handleToggle = () => {
    setBusy('toggle')
    setFeedback(null)
    startTransition(async () => {
      try {
        await toggleEmail(account.id, !account.enabled)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
      } finally {
        setBusy(null)
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Desconectar a conta ${account.identifier}? As mensagens já recebidas continuam no Inbox.`)) return
    setBusy('delete')
    setFeedback(null)
    startTransition(async () => {
      try {
        await deleteEmail(account.id)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Erro')
        setBusy(null)
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
      {/* Avatar provedor */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: preset.swatch,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <Mail className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{account.displayName || account.identifier}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{preset.label}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-0.5" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          <span className="truncate">{account.identifier}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: status.color }}>
            <Icon className="w-3 h-3" />
            {status.label}
          </span>
          <span>·</span>
          <span>Última verificação: {lastSync}</span>
        </div>
        {account.lastTestError && (
          <div className="mt-1 text-[11px]" style={{ color: 'var(--danger)' }}>
            {account.lastTestError}
          </div>
        )}
        {feedback && (
          <div className="mt-1 text-[11px]" style={{ color: 'var(--text-mute)' }}>
            {feedback}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleTest}
          disabled={busy !== null || pending}
          title="Testar conexão"
          className="btn ghost"
          style={{ fontSize: 11, padding: '6px 10px' }}
        >
          {busy === 'test' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Testar
        </button>
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy !== null || pending}
          title={account.enabled ? 'Desativar (pausa o cron)' : 'Ativar'}
          className="btn ghost"
          style={{ fontSize: 11, padding: '6px 10px' }}
        >
          {account.enabled ? 'Ativa' : 'Inativa'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy !== null || pending}
          className="btn ghost"
          style={{ fontSize: 11, padding: '6px 10px' }}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy !== null || pending}
          title="Desconectar"
          className="btn ghost"
          style={{ fontSize: 11, padding: '6px 10px', color: 'var(--danger)' }}
        >
          {busy === 'delete' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </li>
  )
}

// ============================================================================
// Wizard modal — 2 passos: escolher provedor → credenciais
// ============================================================================

interface DraftState {
  provider: EmailProviderId
  displayName: string
  imapUser: string
  imapHost: string
  imapPort: number
  imapTls: boolean
  imapPassword: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpTls: boolean
  smtpPassword: string
  fromName: string
  fromEmail: string
}

function buildDraft(provider: EmailProviderId, base?: Partial<DraftState>): DraftState {
  const defaults = applyProviderDefaults(provider)
  return {
    provider,
    displayName: base?.displayName ?? '',
    imapUser: base?.imapUser ?? '',
    imapHost: base?.imapHost ?? defaults.imapHost,
    imapPort: base?.imapPort ?? defaults.imapPort,
    imapTls: base?.imapTls ?? defaults.imapTls,
    imapPassword: '',
    smtpHost: base?.smtpHost ?? defaults.smtpHost,
    smtpPort: base?.smtpPort ?? defaults.smtpPort,
    smtpUser: base?.smtpUser ?? base?.imapUser ?? '',
    smtpTls: base?.smtpTls ?? defaults.smtpTls,
    smtpPassword: '',
    fromName: base?.fromName ?? '',
    fromEmail: base?.fromEmail ?? '',
  }
}

function EmailWizardModal({ editing, onClose }: { editing: EmailAccount | null; onClose: () => void }) {
  // Se está editando, pula passo 1 e usa o provider atual
  const initialProvider: EmailProviderId | null = editing
    ? ((editing.provider as EmailProviderId) ?? 'custom')
    : null

  const [step, setStep] = useState<'pick' | 'form'>(editing ? 'form' : 'pick')
  const [draft, setDraft] = useState<DraftState>(
    editing
      ? buildDraft((editing.provider as EmailProviderId) ?? 'custom', {
          displayName: editing.displayName ?? '',
          imapUser: editing.identifier ?? '',
          imapHost: editing.config.imapHost,
          imapPort: editing.config.imapPort,
          imapTls: editing.config.imapTls,
          smtpHost: editing.config.smtpHost,
          smtpPort: editing.config.smtpPort,
          smtpUser: editing.config.smtpUser,
          smtpTls: editing.config.smtpTls,
          fromName: editing.config.fromName ?? '',
          fromEmail: editing.config.fromEmail ?? '',
        })
      : buildDraft('custom')
  )
  const [advanced, setAdvanced] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; imap: TestResultLine; smtp: TestResultLine } | null>(null)
  const [busy, setBusy] = useState<null | 'test' | 'save'>(null)
  const [error, setError] = useState<string | null>(null)

  const pickProvider = (p: EmailProviderId) => {
    setDraft(buildDraft(p))
    setStep('form')
  }

  const onEmailBlur = () => {
    // Auto-sugerir provedor pelo sufixo do email
    if (draft.imapUser && !editing) {
      const detected = detectProviderByEmail(draft.imapUser)
      if (detected !== draft.provider) {
        // Atualiza provider e re-aplica defaults preservando o que já foi digitado
        setDraft({ ...buildDraft(detected, draft), imapUser: draft.imapUser })
      }
    }
    // Auto-preencher displayName se vazio
    if (!draft.displayName && draft.imapUser) {
      setDraft((d) => ({ ...d, displayName: draft.imapUser }))
    }
    // Auto-preencher smtpUser e fromEmail
    if (!draft.smtpUser && draft.imapUser) {
      setDraft((d) => ({ ...d, smtpUser: draft.imapUser }))
    }
    if (!draft.fromEmail && draft.imapUser) {
      setDraft((d) => ({ ...d, fromEmail: draft.imapUser }))
    }
  }

  const runTest = async () => {
    setBusy('test')
    setError(null)
    setTest(null)
    try {
      const r = await testEmailDraft(draft)
      setTest(r)
      if (!r.ok) {
        setError(`Falha: ${!r.imap.ok ? `IMAP — ${r.imap.message}` : ''}${!r.smtp.ok ? ` · SMTP — ${r.smtp.message}` : ''}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado ao testar')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    try {
      if (editing) {
        await updateEmail(editing.id, draft)
      } else {
        await createEmail(draft)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(null)
    }
  }

  const canSave = (test?.ok ?? false) || (!!editing && !draft.imapPassword)
  const preset = EMAIL_PROVIDERS[draft.provider]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {editing ? 'Editar conta' : 'Conectar e-mail'}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {step === 'pick' ? 'Escolha seu provedor' : preset.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}
            disabled={busy !== null}
          >
            Fechar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 'pick' ? (
            <ProviderPicker onPick={pickProvider} />
          ) : (
            <ProviderForm
              preset={preset}
              draft={draft}
              setDraft={setDraft}
              advanced={advanced}
              setAdvanced={setAdvanced}
              onEmailBlur={onEmailBlur}
              test={test}
              error={error}
              isEditing={!!editing}
            />
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <footer
            className="px-5 py-4 flex items-center justify-between shrink-0"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="btn ghost"
              style={{ fontSize: 12 }}
              disabled={busy !== null || !!editing}
            >
              ← Trocar provedor
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runTest}
                className="btn"
                style={{ fontSize: 12 }}
                disabled={busy !== null || !draft.imapUser || (!draft.imapPassword && !editing)}
              >
                {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Testar conexão
              </button>
              <button
                type="button"
                onClick={save}
                className="btn primary"
                style={{ fontSize: 12 }}
                disabled={busy !== null || !canSave}
                title={!canSave ? 'Faça o teste de conexão antes de salvar' : 'Salvar e ativar'}
              >
                {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {editing ? 'Salvar alterações' : 'Salvar e ativar'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

function ProviderPicker({ onPick }: { onPick: (p: EmailProviderId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {EMAIL_PROVIDERS_LIST.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className="text-left transition"
          style={{
            padding: 16,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.background = 'var(--surface-3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'var(--surface-2)'
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: p.swatch,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              marginBottom: 10,
            }}
          >
            <Mail className="w-4 h-4" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.hint}</div>
        </button>
      ))}
    </div>
  )
}

function ProviderForm({
  preset,
  draft,
  setDraft,
  advanced,
  setAdvanced,
  onEmailBlur,
  test,
  error,
  isEditing,
}: {
  preset: EmailProviderPreset
  draft: DraftState
  setDraft: (d: DraftState) => void
  advanced: boolean
  setAdvanced: (a: boolean) => void
  onEmailBlur: () => void
  test: { ok: boolean; imap: TestResultLine; smtp: TestResultLine } | null
  error: string | null
  isEditing: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Help do provedor */}
      <div
        style={{
          padding: 12,
          background: 'var(--accent-soft)',
          border: '1px solid rgba(200, 240, 81, 0.2)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text)',
          lineHeight: 1.5,
        }}
      >
        {preset.helpText}
        {preset.helpUrl && (
          <div className="mt-2">
            <a
              href={preset.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
              style={{ color: 'var(--accent)', fontWeight: 600 }}
            >
              {preset.helpUrlLabel ?? 'Abrir página'} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Campos principais */}
      <div className="space-y-3">
        <div>
          <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
            Nome de exibição
          </label>
          <input
            data-phb-input
            className={inputCls}
            value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            placeholder="Ex.: Vendas BH"
            maxLength={120}
          />
        </div>
        <div>
          <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
            E-mail (usuário IMAP/SMTP)
          </label>
          <input
            data-phb-input
            className={inputCls}
            value={draft.imapUser}
            onChange={(e) => setDraft({ ...draft, imapUser: e.target.value })}
            onBlur={onEmailBlur}
            placeholder={preset.id === 'gmail' ? 'voce@gmail.com' : preset.id === 'custom' ? 'voce@empresa.com' : 'voce@dominio.com'}
            type="email"
            autoComplete="email"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
              Senha IMAP {preset.requiresAppPassword && '(senha de app)'}
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={draft.imapPassword}
              onChange={(e) => setDraft({ ...draft, imapPassword: e.target.value })}
              placeholder={isEditing ? '••••••• (deixe vazio para manter)' : '••••••••'}
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
              Senha SMTP
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={draft.smtpPassword}
              onChange={(e) => setDraft({ ...draft, smtpPassword: e.target.value })}
              placeholder={isEditing ? '••••••• (deixe vazio para manter)' : 'Igual à senha IMAP normalmente'}
              type="password"
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      {/* Avançado (collapse) */}
      <details
        open={advanced || preset.id === 'custom'}
        onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}
        style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-mute)',
            marginBottom: 12,
            userSelect: 'none',
          }}
        >
          Configurações avançadas ({preset.id === 'custom' ? 'obrigatórias para servidor próprio' : 'host/porta'})
        </summary>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 eyebrow" style={{ marginBottom: -4 }}>
            IMAP (recebimento)
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Host</label>
            <input data-phb-input className={inputCls} value={draft.imapHost} onChange={(e) => setDraft({ ...draft, imapHost: e.target.value })} placeholder="imap.gmail.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Porta</label>
            <input data-phb-input className={inputCls} value={draft.imapPort} onChange={(e) => setDraft({ ...draft, imapPort: Number(e.target.value) || 993 })} type="number" placeholder="993" />
          </div>
          <label className="flex items-center gap-2 col-span-2" style={{ fontSize: 12 }}>
            <input type="checkbox" checked={draft.imapTls} onChange={(e) => setDraft({ ...draft, imapTls: e.target.checked })} />
            Usar TLS/SSL (recomendado)
          </label>

          <div className="col-span-2 eyebrow" style={{ marginBottom: -4, marginTop: 8 }}>
            SMTP (envio)
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Host</label>
            <input data-phb-input className={inputCls} value={draft.smtpHost} onChange={(e) => setDraft({ ...draft, smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Porta</label>
            <input data-phb-input className={inputCls} value={draft.smtpPort} onChange={(e) => setDraft({ ...draft, smtpPort: Number(e.target.value) || 587 })} type="number" placeholder="587" />
          </div>
          <div className="col-span-2">
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Usuário SMTP (se diferente do e-mail)
            </label>
            <input data-phb-input className={inputCls} value={draft.smtpUser} onChange={(e) => setDraft({ ...draft, smtpUser: e.target.value })} placeholder={draft.imapUser} />
          </div>
          <label className="flex items-center gap-2 col-span-2" style={{ fontSize: 12 }}>
            <input type="checkbox" checked={draft.smtpTls} onChange={(e) => setDraft({ ...draft, smtpTls: e.target.checked })} />
            Usar TLS/STARTTLS (recomendado)
          </label>

          <div className="col-span-2 eyebrow" style={{ marginBottom: -4, marginTop: 8 }}>
            Identidade do remetente (opcional)
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Nome do remetente</label>
            <input data-phb-input className={inputCls} value={draft.fromName} onChange={(e) => setDraft({ ...draft, fromName: e.target.value })} placeholder="BH Grain" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>E-mail do remetente</label>
            <input data-phb-input className={inputCls} value={draft.fromEmail} onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })} placeholder={draft.imapUser} type="email" />
          </div>
        </div>
      </details>

      {/* Feedback do teste */}
      {test && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: test.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
            border: `1px solid ${test.ok ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
            color: test.ok ? 'var(--success)' : 'var(--danger)',
            fontSize: 12,
          }}
        >
          <div className="flex items-center gap-2 mb-1 font-semibold">
            {test.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {test.ok ? 'Conexão validada' : 'Falha na conexão'}
          </div>
          <ul className="space-y-0.5 ml-6" style={{ fontSize: 11 }}>
            <li>
              IMAP: {test.imap.ok ? `✓ ${test.imap.latencyMs}ms` : `✗ ${test.imap.message}`}
            </li>
            <li>
              SMTP: {test.smtp.ok ? `✓ ${test.smtp.latencyMs}ms` : `✗ ${test.smtp.message}`}
            </li>
          </ul>
        </div>
      )}

      {error && !test && (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--danger-soft)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            color: 'var(--danger)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
