'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/Card'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full" variant="elevated">
        <CardTitle>Erro inesperado</CardTitle>
        <CardDescription>{error.message || 'Um erro ocorreu ao carregar a página'}</CardDescription>

        <CardContent>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="primary" onClick={() => reset()} className="w-full">
              Tentar novamente
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = '/')} className="w-full">
              Voltar para home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
