'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Sparkles, Trash2 } from 'lucide-react'

interface PlanInfo {
  slug: string
  name: string
  aiAccess: string
  aiMonthlyMessages: number
}

interface Props {
  canEdit: boolean
  initialMode: string
  initialModel: string
  initialHasKey: boolean
  plan: PlanInfo | null
}

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (rápido, barato)' },
  { value: 'gpt-4o', label: 'GPT-4o (premium)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
]

export function AiSettingsForm({
  canEdit,
  initialMode,
  initialModel,
  initialHasKey,
  plan,
}: Props) {
  const [mode, setMode] = useState(initialMode)
  const [model, setModel] = useState(initialModel)
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(initialHasKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const aiAccess = plan?.aiAccess ?? 'none'
  const byokAllowed = aiAccess === 'byok_allowed'

  const planBadge = plan ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      <Sparkles className="w-3 h-3" />
      {plan.name}
    </span>
  ) : null

  if (aiAccess === 'none') {
    return (
      <div className="max-w-2xl">
        <div className="flex items-start gap-3 p-5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">Plano sem agente AI</p>
            <p className="text-sm">
              Seu plano atual ({plan?.name ?? '—'}) não inclui o agente AI. Faça upgrade para o
              plano Pro (AI gerenciado) ou Enterprise (AI + opção BYOK).
            </p>
            <a
              href="/planos"
              className="inline-block mt-3 px-3 py-1.5 text-xs font-medium rounded bg-amber-900 text-amber-50 hover:bg-amber-800"
            >
              Ver planos
            </a>
          </div>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const body: Record<string, string> = { mode, model }
      if (apiKey.trim()) body.apiKey = apiKey.trim()

      const res = await fetch('/api/workspaces/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          data?.message ||
          (data?.error === 'invalid_key'
            ? 'Chave OpenAI inválida. Deve começar com "sk-" e ter pelo menos 40 chars.'
            : data?.error === 'plan_no_byok'
              ? 'BYOK disponível apenas no plano Enterprise.'
              : data?.error === 'forbidden'
                ? 'Apenas owner/admin pode alterar a configuração de AI.'
                : data?.error || 'Falha ao salvar.')
        throw new Error(msg)
      }
      if (apiKey.trim()) {
        setHasKey(true)
        setApiKey('')
      }
      setSuccess('Configuração salva.')
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveKey = async () => {
    if (
      !confirm(
        'Remover sua chave OpenAI e voltar para o modo gerenciado da plataforma? O agente continuará funcionando com nossa chave (sujeito ao limite do plano).',
      )
    )
      return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/workspaces/ai', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao remover.')
      setHasKey(false)
      setMode('managed')
      setSuccess('Chave removida. Modo gerenciado ativo.')
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {planBadge ? (
        <div className="flex items-center gap-2">
          {planBadge}
          {aiAccess === 'managed' ? (
            <span className="text-xs text-gray-500">
              Inclui {plan?.aiMonthlyMessages === 0 ? 'mensagens ilimitadas' : `${plan?.aiMonthlyMessages} mensagens/mês`}
            </span>
          ) : null}
          {byokAllowed ? (
            <span className="text-xs text-gray-500">Inclui BYOK (chave própria)</span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-2 p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <fieldset
        disabled={!canEdit || busy}
        className="rounded-lg border border-gray-200 bg-white p-6 space-y-5 disabled:opacity-60"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Modo de operação</h3>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="managed"
                checked={mode === 'managed'}
                onChange={() => setMode('managed')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">Gerenciado pela plataforma</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Usamos nossa chave OpenAI. Custo embutido na licença. Limite mensal aplica.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded border ${
                byokAllowed ? 'border-gray-200 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="byok"
                checked={mode === 'byok'}
                disabled={!byokAllowed}
                onChange={() => setMode('byok')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">
                  BYOK — sua chave OpenAI
                  {!byokAllowed ? (
                    <span className="ml-2 text-xs text-gray-500">(Enterprise apenas)</span>
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Você paga consumo direto à OpenAI. Sem limite mensal. Chave criptografada
                  com AES-256-GCM.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo preferido</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a8a3a]"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {mode === 'byok' ? (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Chave OpenAI
            </label>
            {hasKey ? (
              <div className="flex items-center gap-3 p-3 rounded border border-emerald-200 bg-emerald-50 mb-3">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <span className="text-sm text-emerald-800 flex-1">
                  Chave configurada (criptografada).
                </span>
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            ) : null}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={hasKey ? 'Cole nova chave para substituir' : 'sk-proj-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0a8a3a]"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Gere em{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                platform.openai.com/api-keys
              </a>
              . Sua chave nunca trafega em texto puro fora desta requisição.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0a8a3a] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      </fieldset>

      {!canEdit ? (
        <div className="flex items-start gap-2 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Apenas owner ou admin do workspace podem alterar esta configuração.</span>
        </div>
      ) : null}
    </div>
  )
}
