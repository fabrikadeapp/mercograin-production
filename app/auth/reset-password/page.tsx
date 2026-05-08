'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, AlertCircle } from 'lucide-react'
import { Button, Card, Input, Brand } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenEmail, setTokenEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      return
    }
    // Validar token sem consumi-lo
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.valid) {
          setTokenValid(true)
          setTokenEmail(data.email || null)
        } else {
          setTokenValid(false)
        }
      })
      .catch(() => setTokenValid(false))
  }, [token])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (password.length < 8) {
      newErrors.password = 'Senha deve ter no mínimo 8 caracteres'
    }

    if (!passwordConfirm) {
      newErrors.passwordConfirm = 'Confirmação de senha é obrigatória'
    } else if (password !== passwordConfirm) {
      newErrors.passwordConfirm = 'As senhas não correspondem'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return
    if (!token) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, passwordConfirm }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao resetar senha')
      }

      success('Senha alterada com sucesso!')
      setTimeout(() => router.push('/auth/login?reset=ok'), 1500)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao resetar senha')
    } finally {
      setLoading(false)
    }
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
        <div className="absolute top-8 left-8">
          <Brand />
        </div>
        <Card className="w-full max-w-md text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-neg mx-auto" />
          <p className="eyebrow text-neg">Link inválido</p>
          <h2 className="text-h2 font-sans tracking-tight text-fg-1">Link inválido ou expirado</h2>
          <p className="text-fg-2 text-body">
            Solicite um novo link de redefinição de senha.
          </p>
          <Link href="/auth/forgot-password" className="block">
            <Button fullWidth>Solicitar novo link</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center space-y-2">
          <p className="text-fg-2 text-body">Validando link…</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <p className="eyebrow">Recuperação de acesso</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Nova senha</h1>
          <p className="text-fg-2 text-body">
            {tokenEmail ? `Defina uma nova senha para ${tokenEmail}.` : 'Defina uma nova senha para sua conta.'}
          </p>
        </div>

        <Card className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nova senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
              error={errors.password}
              helperText={errors.password ? undefined : 'Mínimo 8 caracteres'}
            />

            <Input
              label="Confirmar senha"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
              error={errors.passwordConfirm}
            />

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Alterando…' : 'Alterar senha'}
            </Button>

            <Link
              href="/auth/login"
              className="block text-center text-fg-3 text-small hover:text-accent transition-colors"
            >
              Voltar ao login
            </Link>
          </form>
        </Card>
      </div>
    </div>
  )
}
