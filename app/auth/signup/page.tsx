'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Lock, AlertCircle } from 'lucide-react'
import { Button, Card, Input, Brand } from '@/components/ui/phb'
import {
  validatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthBarColor,
} from '@/lib/password-validator'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')
  const plan = planParam === 'starter' || planParam === 'pro' || planParam === 'enterprise'
    ? planParam
    : 'pro'
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    senhaConfirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<ReturnType<
    typeof validatePasswordStrength
  > | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === 'senha') {
      setPasswordStrength(validatePasswordStrength(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.senha !== formData.senhaConfirm) {
      setError('As senhas não conferem')
      return
    }

    const strength = validatePasswordStrength(formData.senha)
    if (!strength.isValid) {
      setError('Senha não atende aos critérios mínimos de segurança')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          senha: formData.senha,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao criar conta')
        setLoading(false)
        return
      }

      router.push(
        `/auth/verify-email-pending?email=${encodeURIComponent(formData.email)}&plan=${plan}`
      )
    } catch (err) {
      setError('Erro ao criar conta')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <div className="w-full max-w-md space-y-8 my-12">
        <div className="space-y-2 text-center">
          <p className="eyebrow">Onboarding · Trader</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Crie sua conta.</h1>
          <p className="text-fg-2 text-body">Acesso a cotações, contratos e fluxo de caixa.</p>
        </div>

        <Card className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
              <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="plan" value={plan} />
            <Input
              label="Nome completo"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Seu nome"
              leftIcon={<User className="h-4 w-4 text-fg-3" />}
              required
            />

            <Input
              label="E-mail"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              leftIcon={<Mail className="h-4 w-4 text-fg-3" />}
              required
            />

            <div className="space-y-2">
              <Input
                label="Senha"
                name="senha"
                type="password"
                value={formData.senha}
                onChange={handleChange}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
                required
              />

              {formData.senha && passwordStrength && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getPasswordStrengthBarColor(passwordStrength.strength)}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-micro uppercase tracking-wider font-semibold ${getPasswordStrengthColor(
                        passwordStrength.strength
                      )}`}
                    >
                      {passwordStrength.strength.replace('-', ' ')}
                    </span>
                  </div>

                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-small text-fg-3 space-y-0.5">
                      {passwordStrength.feedback.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-fg-4">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-small text-fg-3">
                Mínimo 8 caracteres com maiúsculas, minúsculas, números e símbolos.
              </p>
            </div>

            <Input
              label="Confirmar senha"
              name="senhaConfirm"
              type="password"
              value={formData.senhaConfirm}
              onChange={handleChange}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
              required
            />

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Criando conta…' : 'Criar conta'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-fg-3 text-small">
          Já tem conta?{' '}
          <Link href="/auth/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
