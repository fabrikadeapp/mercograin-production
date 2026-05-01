'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/contexts/ToastContext'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) {
      showError('Link inválido ou expirado')
      router.push('/auth/login')
    }
  }, [token, router, showError])

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
        body: JSON.stringify({
          token,
          password,
          passwordConfirm,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao resetar senha')
      }

      success('Senha alterada com sucesso!')
      setTimeout(() => router.push('/auth/login'), 1500)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao resetar senha')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md" variant="elevated">
          <CardContent className="py-8 text-center">
            <p className="text-red-600 font-medium mb-4">❌ Link inválido ou expirado</p>
            <Link href="/auth/forgot-password">
              <Button variant="primary" className="w-full">
                Solicitar novo link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🔑 Nova Senha</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.password
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-700"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-xs mt-1">{errors.password}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 8 caracteres
              </p>
            </div>

            {/* Password Confirm */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.passwordConfirm
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {errors.passwordConfirm && (
                <p className="text-red-600 text-xs mt-1">{errors.passwordConfirm}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? '⏳ Alterando...' : '✅ Alterar Senha'}
            </Button>

            {/* Back to Login */}
            <Link href="/auth/login" className="block text-center">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Voltar ao Login
              </button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
