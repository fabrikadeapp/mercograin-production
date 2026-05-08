'use client'
import { useState } from 'react'
import { Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui/phb'
import type { EmpresaInitial } from './OnboardingWizard'

interface Props {
  workspaceId: string
  initial: EmpresaInitial | null
  onSaved: () => void
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((u) => ({ value: u, label: u }))

function maskCnpj(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskTelefone(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
}

function maskCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

export function Step1Empresa({ initial, onSaved }: Props) {
  const [form, setForm] = useState({
    razaoSocial: initial?.razaoSocial || '',
    nomeFantasia: initial?.nomeFantasia || '',
    cnpj: initial?.cnpj || '',
    inscricaoEstadual: initial?.inscricaoEstadual || '',
    endereco: initial?.endereco || '',
    cidade: initial?.cidade || '',
    uf: initial?.uf || '',
    cep: initial?.cep || '',
    telefone: initial?.telefone || '',
    email: initial?.email || '',
    logoUrl: initial?.logoUrl || '',
  })
  const [bancarios, setBancarios] = useState<{
    banco: string
    agencia: string
    conta: string
    titular: string
    pix: string
  }>(() => {
    const d = initial?.dadosBancarios || {}
    return {
      banco: d.banco || '',
      agencia: d.agencia || '',
      conta: d.conta || '',
      titular: d.titular || '',
      pix: d.pix || '',
    }
  })
  const [showBancarios, setShowBancarios] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      setError('Logo deve ter até 500KB')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/onboarding/logo', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Falha no upload')
      const { url } = await res.json()
      set('logoUrl', url)
    } catch (e: any) {
      setError(e?.message || 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.razaoSocial.trim()) {
      setError('Razão social é obrigatória')
      return
    }
    setSaving(true)
    try {
      const hasBancarios = Object.values(bancarios).some((v) => v.trim())
      const res = await fetch('/api/workspace/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          // logoUrl pode ser data: URL ou /uploads/..., aceitamos ambos
          logoUrl: form.logoUrl || null,
          dadosBancarios: hasBancarios ? bancarios : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Erro ao salvar')
      }
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="eyebrow text-fg-3 mb-2">PASSO 1 · EMPRESA</div>
        <h1 className="text-h2 text-fg-1 mb-2">Dados da sua empresa</h1>
        <p className="text-fg-3">
          Esses dados aparecem em propostas, contratos e boletos. Você pode
          editar tudo depois em Configurações.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-neg/10 border border-neg/30 text-neg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Razão social *"
          value={form.razaoSocial}
          onChange={(e) => set('razaoSocial', e.target.value)}
          required
          containerClassName="sm:col-span-2"
        />
        <Input
          label="Nome fantasia"
          value={form.nomeFantasia}
          onChange={(e) => set('nomeFantasia', e.target.value)}
        />
        <Input
          label="CNPJ"
          value={form.cnpj}
          onChange={(e) => set('cnpj', maskCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
        />
        <Input
          label="Inscrição estadual"
          value={form.inscricaoEstadual}
          onChange={(e) => set('inscricaoEstadual', e.target.value)}
        />
        <Input
          label="Telefone"
          value={form.telefone}
          onChange={(e) => set('telefone', maskTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="Email comercial"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          containerClassName="sm:col-span-2"
        />
        <Input
          label="Endereço"
          value={form.endereco}
          onChange={(e) => set('endereco', e.target.value)}
          containerClassName="sm:col-span-2"
        />
        <Input
          label="Cidade"
          value={form.cidade}
          onChange={(e) => set('cidade', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="UF"
            value={form.uf}
            onChange={(e) => set('uf', e.target.value)}
            options={UFS}
            placeholder="—"
          />
          <Input
            label="CEP"
            value={form.cep}
            onChange={(e) => set('cep', maskCep(e.target.value))}
            placeholder="00000-000"
          />
        </div>
      </div>

      {/* Logo */}
      <div className="border border-border-1 rounded-card p-5 bg-bg-1">
        <div className="eyebrow text-fg-3 mb-3">LOGO DA EMPRESA</div>
        <div className="flex items-center gap-4">
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt="Logo"
              className="w-20 h-20 object-contain rounded-md bg-bg-0 border border-border-1"
            />
          ) : (
            <div className="w-20 h-20 rounded-md bg-bg-0 border border-dashed border-border-1 flex items-center justify-center text-fg-4">
              <Upload className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1">
            <label className="btn-secondary btn-sm cursor-pointer inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : form.logoUrl ? 'Trocar logo' : 'Enviar logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
            </label>
            <div className="text-xs text-fg-4 mt-2">
              PNG ou JPG até 500KB. Aparece em propostas e contratos.
            </div>
          </div>
        </div>
      </div>

      {/* Bancários */}
      <div className="border border-border-1 rounded-card bg-bg-1">
        <button
          type="button"
          onClick={() => setShowBancarios((v) => !v)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div>
            <div className="eyebrow text-fg-3">DADOS BANCÁRIOS</div>
            <div className="text-sm text-fg-2 mt-1">
              Opcional. Usado em boletos e contratos.
            </div>
          </div>
          {showBancarios ? (
            <ChevronUp className="w-5 h-5 text-fg-3" />
          ) : (
            <ChevronDown className="w-5 h-5 text-fg-3" />
          )}
        </button>
        {showBancarios && (
          <div className="p-5 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Banco"
              value={bancarios.banco}
              onChange={(e) => setBancarios({ ...bancarios, banco: e.target.value })}
            />
            <Input
              label="Agência"
              value={bancarios.agencia}
              onChange={(e) => setBancarios({ ...bancarios, agencia: e.target.value })}
            />
            <Input
              label="Conta"
              value={bancarios.conta}
              onChange={(e) => setBancarios({ ...bancarios, conta: e.target.value })}
            />
            <Input
              label="Titular"
              value={bancarios.titular}
              onChange={(e) => setBancarios({ ...bancarios, titular: e.target.value })}
            />
            <Input
              label="Chave PIX"
              value={bancarios.pix}
              onChange={(e) => setBancarios({ ...bancarios, pix: e.target.value })}
              containerClassName="sm:col-span-2"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-border-1">
        <Button type="submit" loading={saving} size="lg">
          Salvar e continuar
        </Button>
      </div>
    </form>
  )
}
