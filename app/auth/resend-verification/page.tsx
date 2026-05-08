'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2 } from 'lucide-react'
import { Button, Card, Input, Brand } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export default function ResendVerificationPage() {
  const { success, error: showError } = useToast()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      showError('Email é obrigatório')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || 'Erro ao enviar email')
      } else {
        success(data.message || 'Email de verificação enviado!')
        setSent(true)
        setEmail('')
      }
    } catch (err) {
      showError('Erro ao enviar email')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
        <div className="absolute top-8 left-8">
          <Brand />
        </div>
        <Card className="w-full max-w-md text-center space-y-4">
          <CheckCircle2 className="h-8 w-8 text-pos mx-auto" />
          <p className="eyebrow text-pos">Enviado</p>
          <h1 className="text-h2 font-sans tracking-tight text-fg-1">E-mail enviado</h1>
          <p className="text-fg-2 text-body">
            Verifique sua caixa de entrada para o link de verificação.
          </p>
          <p className="text-small text-fg-3">
            Se não encontrar, verifique a pasta de spam.
          </p>
          <Link href="/auth/login" className="block pt-2">
            <Button fullWidth>Voltar para login</Button>
          </Link>
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
          <p className="eyebrow">Verificação de e-mail</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">
            Reenviar verificação
          </h1>
          <p className="text-fg-2 text-body">
            Informe seu e-mail para receber um novo link.
          </p>
        </div>

        <Card className="space-y-4">
          <form onSubmit={handleResend} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              leftIcon={<Mail className="h-4 w-4 text-fg-3" />}
              disabled={loading}
            />

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Enviando…' : 'Reenviar e-mail'}
            </Button>
          </form>

          <p className="text-center text-fg-3 text-small">
            Lembrou sua senha?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">
              Voltar para login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
