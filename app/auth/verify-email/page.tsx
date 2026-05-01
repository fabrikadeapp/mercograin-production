'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setError('Token de verificação ausente')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Erro ao verificar email')
          setLoading(false)
          return
        }

        setVerified(true)
        setLoading(false)

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth/login')
        }, 3000)
      } catch (err) {
        setError('Erro ao verificar email')
        setLoading(false)
      }
    }

    verifyEmail()
  }, [searchParams, router])

  if (loading) {
    return <LoadingSpinner fullScreen text="Verificando email..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {verified ? '✅ Email Verificado!' : '❌ Erro ao Verificar Email'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {verified ? (
            <>
              <p className="text-gray-600">
                Seu email foi verificado com sucesso! Você será redirecionado para o login em breve.
              </p>
              <Link href="/auth/login">
                <Button variant="primary" className="w-full">
                  Ir para Login
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                {error}
              </p>
              <div className="space-y-2">
                <Link href="/auth/login">
                  <Button variant="primary" className="w-full">
                    Voltar para Login
                  </Button>
                </Link>
                <Link href="/auth/resend-verification">
                  <Button variant="secondary" className="w-full">
                    Reenviar Email de Verificação
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
