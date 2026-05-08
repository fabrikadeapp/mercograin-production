'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Inbox, Lightbulb } from 'lucide-react'
import { Button, Card, Brand } from '@/components/ui/phb'

export default function VerifyEmailPendingPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'seu email'

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <div className="w-full max-w-md space-y-6 my-8">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 mx-auto rounded-pill bg-bg-2 border border-border-2 flex items-center justify-center">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <p className="eyebrow">Conta criada</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Confirme seu e-mail</h1>
          <p className="text-fg-2 text-body">
            Enviamos um link de verificação para sua caixa de entrada.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="rounded-md border border-border-1 bg-bg-2 p-3 space-y-1">
            <p className="text-micro uppercase tracking-wider text-fg-3 font-semibold">
              E-mail de destino
            </p>
            <p className="text-fg-1 text-body break-words">{email}</p>
          </div>

          <div className="space-y-2">
            <p className="eyebrow">Próximas etapas</p>
            <ol className="space-y-1.5 text-small text-fg-2">
              <li className="flex gap-2">
                <span className="text-fg-3 t-num">1.</span>
                <span>Verifique sua caixa de entrada.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fg-3 t-num">2.</span>
                <span>Clique no link &ldquo;Verificar e-mail&rdquo;.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fg-3 t-num">3.</span>
                <span>Faça login com suas credenciais.</span>
              </li>
            </ol>
          </div>

          <div className="rounded-md border border-l-2 border-border-1 border-l-warn bg-bg-2 p-3 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-warn shrink-0 mt-0.5" />
            <p className="text-small text-fg-2">
              <span className="text-fg-1 font-medium">Dica:</span> não encontrou o e-mail? Verifique
              a pasta de spam.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Link href={`/auth/resend-verification?email=${encodeURIComponent(email)}`}>
              <Button variant="secondary" fullWidth leftIcon={<Inbox className="h-4 w-4" />}>
                Reenviar e-mail de verificação
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost" fullWidth>
                Voltar para login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
