'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button, Card, Brand } from '@/components/ui/phb'

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

        setTimeout(() => router.push('/auth/login'), 3000)
      } catch (err) {
        setError('Erro ao verificar email')
        setLoading(false)
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <Card className="w-full max-w-md text-center space-y-4">
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 text-accent mx-auto animate-spin" />
            <p className="eyebrow">Aguarde</p>
            <h1 className="text-h2 font-sans tracking-tight text-fg-1">Verificando e-mail…</h1>
            <p className="text-fg-2 text-body">Isso leva apenas alguns segundos.</p>
          </>
        ) : verified ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-pos mx-auto" />
            <p className="eyebrow text-pos">Verificado</p>
            <h1 className="text-h2 font-sans tracking-tight text-fg-1">E-mail confirmado</h1>
            <p className="text-fg-2 text-body">
              Você será redirecionado para o login em instantes.
            </p>
            <Link href="/auth/login" className="block pt-2">
              <Button fullWidth>Ir para login</Button>
            </Link>
          </>
        ) : (
          <>
            <XCircle className="h-8 w-8 text-neg mx-auto" />
            <p className="eyebrow text-neg">Erro</p>
            <h1 className="text-h2 font-sans tracking-tight text-fg-1">Falha na verificação</h1>
            <p className="text-fg-2 text-body">{error}</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/auth/login">
                <Button fullWidth>Voltar para login</Button>
              </Link>
              <Link href="/auth/resend-verification">
                <Button variant="secondary" fullWidth>
                  Reenviar verificação
                </Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
