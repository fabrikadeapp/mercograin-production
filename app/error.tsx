'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Card, Brand } from '@/components/ui/phb'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <Card className="max-w-md w-full text-center space-y-4">
        <AlertTriangle className="h-8 w-8 text-neg mx-auto" />
        <p className="eyebrow text-neg">Erro inesperado</p>
        <h1 className="text-h2 font-sans tracking-tight text-fg-1">Algo deu errado</h1>
        <p className="text-fg-2 text-body">
          {error.message || 'Um erro ocorreu ao carregar a página.'}
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <Button fullWidth onClick={() => reset()}>
            Tentar novamente
          </Button>
          <Button variant="secondary" fullWidth onClick={() => (window.location.href = '/')}>
            Voltar ao dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}
