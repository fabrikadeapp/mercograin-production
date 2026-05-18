'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@/components/ui/phb'

interface Props {
  token: string
  email: string
  nomeInicial: string
}

interface EmpresaData {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  cep: string
  endereco: string
  cidade: string
  uf: string
  telefone: string
  email: string
}

const EMPRESA_VAZIA: EmpresaData = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  cep: '',
  endereco: '',
  cidade: '',
  uf: '',
  telefone: '',
  email: '',
}

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCEP(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d{4})(\d)/, '($1) $2-$3')
  }
  return d.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3')
}

export function AtivarWizard({ token, email, nomeInicial }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [nome, setNome] = useState(nomeInicial)
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')

  // Step 2
  const [empresa, setEmpresa] = useState<EmpresaData>(EMPRESA_VAZIA)
  const [cepLoading, setCepLoading] = useState(false)

  async function buscarCNPJ(cnpj: string) {
    const numeros = cnpj.replace(/\D/g, '')
    if (numeros.length !== 14) return
    try {
      const r = await fetch(`/api/br/cnpj/${numeros}`)
      if (!r.ok) return
      const j = await r.json()
      setEmpresa((prev) => ({
        ...prev,
        razaoSocial: j.razaoSocial || prev.razaoSocial,
        nomeFantasia: j.nomeFantasia || prev.nomeFantasia,
        endereco: j.endereco || prev.endereco,
        cidade: j.cidade || prev.cidade,
        uf: j.uf || prev.uf,
        cep: j.cep ? maskCEP(j.cep) : prev.cep,
        telefone: j.telefone ? maskTelefone(j.telefone) : prev.telefone,
        email: j.email || prev.email,
      }))
    } catch {}
  }

  async function buscarCEP(cep: string) {
    const numeros = cep.replace(/\D/g, '')
    if (numeros.length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${numeros}/json/`)
      if (!r.ok) return
      const j = await r.json()
      if (j.erro) return
      setEmpresa((prev) => ({
        ...prev,
        endereco: [j.logradouro, j.bairro].filter(Boolean).join(', '),
        cidade: j.localidade || prev.cidade,
        uf: j.uf || prev.uf,
      }))
    } catch {}
    finally {
      setCepLoading(false)
    }
  }

  function validateStep1(): string | null {
    if (nome.trim().length < 3) return 'Informe seu nome completo'
    if (senha.length < 8) return 'A senha precisa de pelo menos 8 caracteres'
    if (senha !== senha2) return 'As senhas não conferem'
    return null
  }

  function validateStep2(): string | null {
    if (empresa.razaoSocial.trim().length < 2) return 'Razão social obrigatória'
    return null
  }

  function avancar() {
    setError(null)
    const err = validateStep1()
    if (err) {
      setError(err)
      return
    }
    setStep(2)
  }

  async function ativar() {
    setError(null)
    const err = validateStep2()
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch(`/api/ativar/${token}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          senha,
          empresa: {
            razaoSocial: empresa.razaoSocial,
            nomeFantasia: empresa.nomeFantasia || null,
            cnpj: empresa.cnpj || null,
            inscricaoEstadual: empresa.inscricaoEstadual || null,
            endereco: empresa.endereco || null,
            cidade: empresa.cidade || null,
            uf: empresa.uf || null,
            cep: empresa.cep || null,
            telefone: empresa.telefone || null,
            email: empresa.email || null,
          },
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error || 'Erro ao ativar licença')
        setSubmitting(false)
        return
      }
      router.push(j.redirect || '/dashboard')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Erro de rede')
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 md:p-8">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <StepDot active={step >= 1} label="1" />
        <div
          style={{
            flex: 1,
            height: 2,
            background: step >= 2 ? 'var(--accent)' : 'var(--border)',
          }}
        />
        <StepDot active={step >= 2} label="2" />
      </div>
      <div className="mb-6 flex items-center justify-between text-small text-fg-3">
        <span style={{ color: step === 1 ? 'var(--text)' : 'var(--text-mute)' }}>
          Criar senha
        </span>
        <span style={{ color: step === 2 ? 'var(--text)' : 'var(--text-mute)' }}>
          Dados da empresa
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-small text-fg-2 mb-1.5">E-mail</label>
            <Input value={email} disabled />
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Nome completo</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Silva"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Senha</label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Confirmar senha</label>
            <Input
              type="password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="Repita a senha"
            />
          </div>

          {error && (
            <div
              className="text-small px-3 py-2 rounded"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={avancar} variant="primary">
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              CNPJ (busca automática)
            </label>
            <Input
              value={empresa.cnpj}
              onChange={(e) => {
                const v = maskCNPJ(e.target.value)
                setEmpresa({ ...empresa, cnpj: v })
                if (v.replace(/\D/g, '').length === 14) buscarCNPJ(v)
              }}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Razão social *</label>
            <Input
              value={empresa.razaoSocial}
              onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })}
              placeholder="Ex: Mercograin Trading Ltda."
            />
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Nome fantasia</label>
            <Input
              value={empresa.nomeFantasia}
              onChange={(e) => setEmpresa({ ...empresa, nomeFantasia: e.target.value })}
              placeholder="Ex: Mercograin"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="block text-small text-fg-2 mb-1.5">
                CEP {cepLoading && '⏳'}
              </label>
              <Input
                value={empresa.cep}
                onChange={(e) => {
                  const v = maskCEP(e.target.value)
                  setEmpresa({ ...empresa, cep: v })
                  if (v.replace(/\D/g, '').length === 8) buscarCEP(v)
                }}
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-small text-fg-2 mb-1.5">Endereço</label>
              <Input
                value={empresa.endereco}
                onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                placeholder="Rua, número, bairro"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-small text-fg-2 mb-1.5">Cidade</label>
              <Input
                value={empresa.cidade}
                onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-small text-fg-2 mb-1.5">UF</label>
              <Input
                value={empresa.uf}
                onChange={(e) =>
                  setEmpresa({ ...empresa, uf: e.target.value.toUpperCase().slice(0, 2) })
                }
                placeholder="SP"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-small text-fg-2 mb-1.5">
                Inscrição estadual
              </label>
              <Input
                value={empresa.inscricaoEstadual}
                onChange={(e) =>
                  setEmpresa({ ...empresa, inscricaoEstadual: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-small text-fg-2 mb-1.5">
                Telefone da empresa
              </label>
              <Input
                value={empresa.telefone}
                onChange={(e) =>
                  setEmpresa({ ...empresa, telefone: maskTelefone(e.target.value) })
                }
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              E-mail de contato da empresa
            </label>
            <Input
              type="email"
              value={empresa.email}
              onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
              placeholder="contato@empresa.com"
            />
          </div>

          {error && (
            <div
              className="text-small px-3 py-2 rounded"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
              ← Voltar
            </Button>
            <Button variant="primary" onClick={ativar} disabled={submitting}>
              {submitting ? 'Ativando...' : 'Ativar minha conta'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? 'var(--accent-ink)' : 'var(--text-dim)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  )
}
