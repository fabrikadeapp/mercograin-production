import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full" variant="elevated">
        <CardTitle className="text-4xl">404</CardTitle>
        <CardDescription>Página não encontrada</CardDescription>

        <CardContent>
          <p className="text-gray-600 mt-4 mb-6">
            Desculpe, a página que você está procurando não existe ou foi movida.
          </p>

          <div className="flex flex-col gap-3">
            <Link href="/">
              <Button variant="primary" className="w-full">
                Voltar para home
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => window.history.back()} className="w-full">
              Voltar página anterior
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
