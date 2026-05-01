'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function VerifyEmailPendingPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'seu email'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">✉️</div>
          <CardTitle className="text-2xl">Conta Criada com Sucesso!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-700">
              Um email de verificação foi enviado para:
            </p>
            <p className="font-semibold text-gray-900 break-words mt-2">
              {email}
            </p>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Próximas etapas:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Verifique sua caixa de entrada</li>
              <li>Clique no link "Verificar Email"</li>
              <li>Após verificado, você poderá fazer login</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            <p>💡 <strong>Dica:</strong> Se não receber o email em poucos minutos, verifique a pasta de spam.</p>
          </div>

          <div className="space-y-2 pt-4">
            <p className="text-sm text-gray-600">
              Não recebeu o email?
            </p>
            <Link href={`/auth/resend-verification?email=${encodeURIComponent(email)}`}>
              <Button variant="secondary" className="w-full">
                Reenviar Email de Verificação
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <Link href="/auth/login">
              <Button variant="secondary" className="w-full">
                Voltar para Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
