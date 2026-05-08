'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2 } from 'lucide-react'
import { Button, Card, Input, Brand } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export default function ForgotPasswordPage() {
  const { success, error: showError } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      showError('Por favor, informe seu email')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao processar solicitação')
      }

      setSent(true)
      success('Email enviado! Verifique sua caixa de entrada.')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
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
          <p className="eyebrow">Recuperação de acesso</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">
            Recuperar senha
          </h1>
          <p className="text-fg-2 text-body">
            Informe seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
        </div>

        <Card className="space-y-4">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md border border-l-2 border-border-1 border-l-pos bg-bg-2 p-4 text-left flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-pos shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-small font-semibold text-fg-1">E-mail enviado</p>
                  <p className="text-small text-fg-2">
                    Verifique sua caixa de entrada para o link de recuperação.
                  </p>
                  <p className="text-micro text-fg-3 uppercase tracking-wider pt-1">
                    O link expira em 1 hora.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSent(false)}
                className="text-accent text-small hover:underline"
              >
                Tentar novamente
              </button>

              <Link href="/auth/login" className="block">
                <Button variant="secondary" fullWidth>
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                leftIcon={<Mail className="h-4 w-4 text-fg-3" />}
              />

              <Button type="submit" fullWidth loading={loading}>
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </Button>

              <Link
                href="/auth/login"
                className="block text-center text-fg-3 text-small hover:text-accent transition-colors"
              >
                Voltar ao login
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
