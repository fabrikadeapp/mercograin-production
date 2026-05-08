'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingShell } from './OnboardingShell'
import { Step1Empresa } from './Step1Empresa'
import { Step2Equipe } from './Step2Equipe'
import { Step3Clientes } from './Step3Clientes'
import { Step4Fornecedores } from './Step4Fornecedores'
import { Step5Template } from './Step5Template'
import { Step6Tour } from './Step6Tour'

export interface EmpresaInitial {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  endereco: string
  cidade: string
  uf: string
  cep: string
  telefone: string
  email: string
  logoUrl: string
  dadosBancarios: any
}

interface Props {
  workspace: { id: string; name: string; ownerName: string }
  initialEmpresa: EmpresaInitial | null
}

export function OnboardingWizard({ workspace, initialEmpresa }: Props) {
  const [step, setStep] = useState(1)
  const [completing, setCompleting] = useState(false)
  const router = useRouter()

  async function next() {
    if (step < 6) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setCompleting(true)
      try {
        const res = await fetch('/api/onboarding/complete', { method: 'POST' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          alert(j?.message || j?.error || 'Erro ao concluir onboarding')
          setCompleting(false)
          return
        }
        router.push('/dashboard?onboarding=ok')
      } catch (e) {
        alert('Erro ao concluir onboarding')
        setCompleting(false)
      }
    }
  }

  function back() {
    if (step > 1) setStep(step - 1)
  }

  return (
    <OnboardingShell step={step} totalSteps={6} ownerName={workspace.ownerName}>
      {step === 1 && (
        <Step1Empresa
          workspaceId={workspace.id}
          initial={initialEmpresa}
          onSaved={next}
        />
      )}
      {step === 2 && (
        <Step2Equipe
          workspaceId={workspace.id}
          onNext={next}
          onSkip={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <Step3Clientes
          workspaceId={workspace.id}
          onNext={next}
          onSkip={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <Step4Fornecedores
          workspaceId={workspace.id}
          onNext={next}
          onSkip={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <Step5Template
          workspaceId={workspace.id}
          onNext={next}
          onSkip={next}
          onBack={back}
        />
      )}
      {step === 6 && (
        <Step6Tour
          ownerName={workspace.ownerName}
          onComplete={next}
          onBack={back}
          completing={completing}
        />
      )}
    </OnboardingShell>
  )
}
