'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Input, Select, Button } from '@/components/ui/phb'
import { isValidCPF } from '@/lib/br/documento'
import {
  BANCOS_BR,
  TIPOS_CONTA,
  TIPOS_PIX,
  maskCEP,
  maskCPF,
  maskPIS,
  maskRG,
  maskTelefone,
  isValidPixKey,
  isValidTelefoneBR,
  onlyDigits,
  type DadosBancariosColaborador,
  type PixTipo,
} from '@/lib/equipe/rh'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
].map((u) => ({ value: u, label: u }))

export interface WizardInitial {
  cpf: string
  telefone: string
  rg: string
  rgEmissor: string
  dataNascimento: string
  pis: string
  enderecoCep: string
  enderecoRua: string
  enderecoNumero: string
  enderecoComplemento: string
  enderecoBairro: string
  enderecoCidade: string
  enderecoUF: string
  dadosBancarios: DadosBancariosColaborador
  contatoEmergenciaNome: string
  contatoEmergenciaTelefone: string
}

interface Props {
  nome: string
  email: string
  initial: WizardInitial
}

const STEPS = ['Dados pessoais', 'Endereço', 'Banco e emergência'] as const

export function CompletarPerfilWizard({ nome, email, initial }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardInitial>(() => ({
    ...initial,
    cpf: initial.cpf ? maskCPF(initial.cpf) : '',
    telefone: initial.telefone ? maskTelefone(initial.telefone) : '',
    pis: initial.pis ? maskPIS(initial.pis) : '',
    enderecoCep: initial.enderecoCep ? maskCEP(initial.enderecoCep) : '',
    contatoEmergenciaTelefone: initial.contatoEmergenciaTelefone
      ? maskTelefone(initial.contatoEmergenciaTelefone)
      : '',
  }))
  const [err, setErr] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [pending, startTransition] = useTransition()

  function patch<K extends keyof WizardInitial>(k: K, v: WizardInitial[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function patchBank<K extends keyof DadosBancariosColaborador>(k: K, v: DadosBancariosColaborador[K]) {
    setForm((f) => ({ ...f, dadosBancarios: { ...f.dadosBancarios, [k]: v } }))
  }

  async function handleCepBlur() {
    const digits = onlyDigits(form.enderecoCep)
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return
      const d = await res.json()
      if (d?.erro) return
      setForm((f) => ({
        ...f,
        enderecoRua: f.enderecoRua || d.logradouro || '',
        enderecoBairro: f.enderecoBairro || d.bairro || '',
        enderecoCidade: f.enderecoCidade || d.localidade || '',
        enderecoUF: f.enderecoUF || d.uf || '',
      }))
    } catch {
      /* silencioso */
    } finally {
      setCepLoading(false)
    }
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!isValidCPF(form.cpf)) return 'CPF inválido — confira os dígitos.'
      if (form.rg.trim().length < 3) return 'Informe o RG.'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento))
        return 'Informe a data de nascimento.'
      const idade =
        (Date.now() - new Date(form.dataNascimento).getTime()) /
        (365.25 * 24 * 3600 * 1000)
      if (idade < 14 || idade > 100) return 'Data de nascimento fora do intervalo válido.'
      if (!isValidTelefoneBR(form.telefone)) return 'Telefone inválido.'
    }
    if (s === 1) {
      if (onlyDigits(form.enderecoCep).length !== 8) return 'CEP inválido.'
      if (!form.enderecoRua.trim()) return 'Informe a rua.'
      if (!form.enderecoNumero.trim()) return 'Informe o número.'
      if (!form.enderecoBairro.trim()) return 'Informe o bairro.'
      if (!form.enderecoCidade.trim()) return 'Informe a cidade.'
      if (form.enderecoUF.length !== 2) return 'Selecione a UF.'
    }
    if (s === 2) {
      const b = form.dadosBancarios
      if (!b.banco || !b.bancoNome) return 'Selecione o banco.'
      if (!b.agencia.trim()) return 'Informe a agência.'
      if (!b.conta.trim()) return 'Informe a conta.'
      if (!b.titular.trim()) return 'Informe o titular da conta.'
      if (b.pix && b.pix.trim().length > 0) {
        if (!b.pixTipo) return 'Selecione o tipo da chave PIX.'
        if (!isValidPixKey(b.pixTipo as PixTipo, b.pix))
          return 'Chave PIX inválida para o tipo selecionado.'
      }
      if (form.contatoEmergenciaNome.trim().length < 2)
        return 'Informe o contato de emergência.'
      if (!isValidTelefoneBR(form.contatoEmergenciaTelefone))
        return 'Telefone de emergência inválido.'
    }
    return null
  }

  function next() {
    setErr(null)
    const v = validateStep(step)
    if (v) {
      setErr(v)
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  function prev() {
    setErr(null)
    setStep((s) => Math.max(0, s - 1))
  }

  function submit() {
    setErr(null)
    for (let i = 0; i <= 2; i++) {
      const v = validateStep(i)
      if (v) {
        setErr(v)
        setStep(i)
        return
      }
    }
    startTransition(async () => {
      const payload = {
        cpf: onlyDigits(form.cpf),
        telefone: onlyDigits(form.telefone),
        rg: form.rg,
        rgEmissor: form.rgEmissor || null,
        dataNascimento: form.dataNascimento,
        pis: form.pis ? onlyDigits(form.pis) : null,
        enderecoCep: onlyDigits(form.enderecoCep),
        enderecoRua: form.enderecoRua,
        enderecoNumero: form.enderecoNumero,
        enderecoComplemento: form.enderecoComplemento || null,
        enderecoBairro: form.enderecoBairro,
        enderecoCidade: form.enderecoCidade,
        enderecoUF: form.enderecoUF,
        dadosBancarios: {
          ...form.dadosBancarios,
          pixTipo: form.dadosBancarios.pix
            ? form.dadosBancarios.pixTipo || null
            : null,
        },
        contatoEmergenciaNome: form.contatoEmergenciaNome,
        contatoEmergenciaTelefone: onlyDigits(form.contatoEmergenciaTelefone),
      }
      const res = await fetch('/api/perfil/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j?.error || 'Erro ao salvar perfil.')
        return
      }
      // Força refresh do JWT no próximo navigation
      router.refresh()
      router.push('/dashboard')
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-0, var(--surface-0))',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <header style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            PERFIL · COMPLETAR CADASTRO
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Olá, {nome.split(' ')[0]}.
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: 'var(--text-mute)',
            }}
          >
            Antes de acessar o sistema precisamos de alguns dados de RH.
            Leva 2 minutos — você pode revisar depois em Meu Perfil.
          </p>
        </header>

        <ProgressBar step={step} />

        <section
          className="sec-card"
          style={{
            padding: 24,
            marginTop: 18,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        >
          {step === 0 && (
            <Step1
              form={form}
              patch={patch}
              email={email}
            />
          )}
          {step === 1 && (
            <Step2
              form={form}
              patch={patch}
              cepLoading={cepLoading}
              onCepBlur={handleCepBlur}
            />
          )}
          {step === 2 && (
            <Step3
              form={form}
              patch={patch}
              patchBank={patchBank}
            />
          )}

          {err && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: 'rgba(255,80,80,0.10)',
                border: '1px solid var(--danger, #ff5050)',
                borderRadius: 8,
                color: 'var(--danger, #ff5050)',
                fontSize: 13,
              }}
            >
              {err}
            </div>
          )}
        </section>

        <footer
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={prev}
            disabled={step === 0 || pending}
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={pending}>
              Próximo <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} loading={pending}>
              <Check className="w-4 h-4" /> Concluir cadastro
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                height: 4,
                borderRadius: 4,
                background:
                  done || active ? 'var(--accent)' : 'var(--border)',
                opacity: done || active ? 1 : 0.6,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: active ? 'var(--text)' : 'var(--text-dim)',
                fontFamily: 'var(--f-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {i + 1}. {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Dados pessoais
// ---------------------------------------------------------------------------

function Step1({
  form,
  patch,
  email,
}: {
  form: WizardInitial
  patch: <K extends keyof WizardInitial>(k: K, v: WizardInitial[K]) => void
  email: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input label="E-mail" value={email} disabled containerClassName="sm:col-span-2" />
      <Input
        label="CPF *"
        value={form.cpf}
        onChange={(e) => patch('cpf', maskCPF(e.target.value))}
        placeholder="000.000.000-00"
        inputMode="numeric"
      />
      <Input
        label="Data de nascimento *"
        type="date"
        value={form.dataNascimento}
        onChange={(e) => patch('dataNascimento', e.target.value)}
      />
      <Input
        label="RG *"
        value={form.rg}
        onChange={(e) => patch('rg', maskRG(e.target.value))}
        placeholder="00.000.000-0"
      />
      <Input
        label="Órgão emissor"
        value={form.rgEmissor}
        onChange={(e) => patch('rgEmissor', e.target.value.toUpperCase().slice(0, 20))}
        placeholder="SSP/RS"
      />
      <Input
        label="Telefone / WhatsApp *"
        value={form.telefone}
        onChange={(e) => patch('telefone', maskTelefone(e.target.value))}
        placeholder="(00) 0 0000-0000"
        inputMode="tel"
      />
      <Input
        label="PIS / NIS"
        value={form.pis}
        onChange={(e) => patch('pis', maskPIS(e.target.value))}
        placeholder="000.00000.00-0"
        inputMode="numeric"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Endereço
// ---------------------------------------------------------------------------

function Step2({
  form,
  patch,
  cepLoading,
  onCepBlur,
}: {
  form: WizardInitial
  patch: <K extends keyof WizardInitial>(k: K, v: WizardInitial[K]) => void
  cepLoading: boolean
  onCepBlur: () => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
      <Input
        label={cepLoading ? 'CEP · consultando…' : 'CEP *'}
        value={form.enderecoCep}
        onChange={(e) => patch('enderecoCep', maskCEP(e.target.value))}
        onBlur={onCepBlur}
        placeholder="00000-000"
        inputMode="numeric"
        rightAddon={cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        containerClassName="sm:col-span-2"
      />
      <Input
        label="Rua / logradouro *"
        value={form.enderecoRua}
        onChange={(e) => patch('enderecoRua', e.target.value)}
        containerClassName="sm:col-span-4"
      />
      <Input
        label="Número *"
        value={form.enderecoNumero}
        onChange={(e) => patch('enderecoNumero', e.target.value.slice(0, 10))}
        containerClassName="sm:col-span-1"
      />
      <Input
        label="Complemento"
        value={form.enderecoComplemento}
        onChange={(e) => patch('enderecoComplemento', e.target.value)}
        placeholder="Apto, casa, fundos…"
        containerClassName="sm:col-span-2"
      />
      <Input
        label="Bairro *"
        value={form.enderecoBairro}
        onChange={(e) => patch('enderecoBairro', e.target.value)}
        containerClassName="sm:col-span-3"
      />
      <Input
        label="Cidade *"
        value={form.enderecoCidade}
        onChange={(e) => patch('enderecoCidade', e.target.value)}
        containerClassName="sm:col-span-4"
      />
      <Select
        label="UF *"
        value={form.enderecoUF}
        onChange={(e) => patch('enderecoUF', e.target.value)}
        options={UFS}
        placeholder="—"
        containerClassName="sm:col-span-2"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Banco + Emergência
// ---------------------------------------------------------------------------

function Step3({
  form,
  patch,
  patchBank,
}: {
  form: WizardInitial
  patch: <K extends keyof WizardInitial>(k: K, v: WizardInitial[K]) => void
  patchBank: <K extends keyof DadosBancariosColaborador>(
    k: K,
    v: DadosBancariosColaborador[K],
  ) => void
}) {
  const b = form.dadosBancarios
  const bancoOptions = [
    ...BANCOS_BR.map((banco) => ({
      value: banco.codigo,
      label: `${banco.codigo} — ${banco.nome}`,
    })),
    { value: 'outro', label: 'Outro banco…' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}
        >
          Dados bancários
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Banco *"
            value={b.banco}
            onChange={(e) => {
              const v = e.target.value
              const banco = BANCOS_BR.find((bn) => bn.codigo === v)
              patchBank('banco', v)
              patchBank('bancoNome', banco?.nome || (v === 'outro' ? '' : ''))
            }}
            options={bancoOptions}
            placeholder="Selecionar banco"
            containerClassName="sm:col-span-2"
          />
          {b.banco === 'outro' && (
            <Input
              label="Nome do banco *"
              value={b.bancoNome}
              onChange={(e) => patchBank('bancoNome', e.target.value)}
              containerClassName="sm:col-span-2"
            />
          )}
          <Input
            label="Agência *"
            value={b.agencia}
            onChange={(e) => patchBank('agencia', e.target.value.slice(0, 10))}
            placeholder="0000"
          />
          <Input
            label="Conta *"
            value={b.conta}
            onChange={(e) => patchBank('conta', e.target.value.slice(0, 20))}
            placeholder="00000-0"
          />
          <Select
            label="Tipo de conta *"
            value={b.tipo}
            onChange={(e) => patchBank('tipo', e.target.value as DadosBancariosColaborador['tipo'])}
            options={TIPOS_CONTA.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Input
            label="Titular da conta *"
            value={b.titular}
            onChange={(e) => patchBank('titular', e.target.value)}
          />
          <Select
            label="Tipo da chave PIX"
            value={b.pixTipo || ''}
            onChange={(e) =>
              patchBank('pixTipo', (e.target.value || '') as DadosBancariosColaborador['pixTipo'])
            }
            options={TIPOS_PIX.map((t) => ({ value: t.value, label: t.label }))}
            placeholder="— sem PIX —"
          />
          <Input
            label="Chave PIX"
            value={b.pix}
            onChange={(e) => patchBank('pix', e.target.value)}
            placeholder={b.pixTipo === 'aleatoria' ? 'UUID…' : 'CPF/email/telefone…'}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}
        >
          Contato de emergência
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nome completo *"
            value={form.contatoEmergenciaNome}
            onChange={(e) => patch('contatoEmergenciaNome', e.target.value)}
          />
          <Input
            label="Telefone *"
            value={form.contatoEmergenciaTelefone}
            onChange={(e) =>
              patch('contatoEmergenciaTelefone', maskTelefone(e.target.value))
            }
            placeholder="(00) 0 0000-0000"
            inputMode="tel"
          />
        </div>
      </div>
    </div>
  )
}
