'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🔑 Recuperar Senha</CardTitle>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✅ Email Enviado!</p>
                <p className="text-green-700 text-sm mt-2">
                  Verifique sua caixa de entrada para o link de recuperação.
                </p>
                <p className="text-green-600 text-xs mt-3">
                  O link expira em 1 hora.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-600 text-sm">Não recebeu o email?</p>
                <button
                  onClick={() => setSent(false)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Tentar novamente
                </button>
              </div>

              <Link href="/auth/login" className="block mt-6">
                <Button variant="secondary" className="w-full">
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-xs text-gray-600">
                Informe o email associado à sua conta. Enviaremos um link para recuperar sua senha.
              </p>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? '⏳ Enviando...' : '✉️ Enviar Link'}
              </Button>

              <Link href="/auth/login" className="block text-center">
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Voltar ao Login
                </button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
