'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import Link from 'next/link'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { Button, Card, Input, Brand } from '@/components/ui/phb'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')
  const plan =
    planParam === 'starter' || planParam === 'pro' || planParam === 'enterprise'
      ? planParam
      : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [twofa, setTwofa] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        ...(twofa
          ? useRecovery
            ? { recoveryCode }
            : { totpCode }
          : {}),
        redirect: false,
      })

      if (!result?.ok) {
        const errMsg = (result as any)?.error || ''
        if (errMsg.includes('2FA_REQUIRED')) {
          setTwofa(true)
          setError('')
          setLoading(false)
          return
        }
        if (errMsg.includes('2FA_INVALID')) {
          setError('Código 2FA inválido')
          setLoading(false)
          return
        }
        setError('Email ou senha inválidos')
        setLoading(false)
        return
      }

      // Decide redirect: se houver plan e user não tem assinatura ativa, vai pro checkout
      if (plan) {
        try {
          const sess = await getSession()
          const subStatus = (sess?.user as any)?.subscriptionStatus
          if (!['trialing', 'active'].includes(subStatus)) {
            router.push(`/assinatura/checkout?plan=${plan}`)
            return
          }
        } catch {
          /* ignore */
        }
      }
      router.push('/dashboard')
    } catch (err) {
      setError('Erro ao fazer login')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <p className="eyebrow">Acesso · Mesa de operações</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Bem-vindo de volta.</h1>
          <p className="text-fg-2 text-body">Entre para acompanhar suas cotações em tempo real.</p>
        </div>

        <Card className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
              <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              leftIcon={<Mail className="h-4 w-4 text-fg-3" />}
              required
            />

            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
              required
            />

            <div className="flex justify-end -mt-1">
              <Link
                href="/auth/forgot-password"
                className="text-fg-3 text-small hover:text-accent transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            {twofa && !useRecovery && (
              <div className="space-y-2">
                <Input
                  label="Código 2FA (6 dígitos)"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setUseRecovery(true)}
                  className="text-fg-3 text-small hover:text-accent"
                >
                  Usar código de recuperação
                </button>
              </div>
            )}
            {twofa && useRecovery && (
              <div className="space-y-2">
                <Input
                  label="Código de recuperação"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XX"
                  required
                />
                <button
                  type="button"
                  onClick={() => setUseRecovery(false)}
                  className="text-fg-3 text-small hover:text-accent"
                >
                  Voltar para código TOTP
                </button>
              </div>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Conectando…' : 'Entrar'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-fg-3 text-small">
          Ainda não tem conta?{' '}
          <Link href="/auth/signup" className="text-accent hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
