'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card variant="elevated" className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">✉️ Email Enviado!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Verifique sua caixa de entrada para o email de verificação.
            </p>
            <p className="text-sm text-gray-500">
              Se não encontrar, verifique sua pasta de spam.
            </p>
            <Link href="/auth/login">
              <Button variant="primary" className="w-full">
                Voltar para Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Reenviar Email de Verificação</CardTitle>
          <CardDescription>
            Digite seu email para receber um novo link de verificação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResend} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={loading}
              disabled={loading}
            >
              Reenviar Email
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Lembrou sua senha?{' '}
              <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                Voltar para Login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
