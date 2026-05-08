import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button, Card, Brand } from '@/components/ui/phb'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Brand />
      </div>

      <Card className="max-w-md w-full text-center space-y-4">
        <Compass className="h-8 w-8 text-fg-3 mx-auto" />
        <p className="eyebrow text-neg">Erro 404</p>
        <h1 className="text-h1 font-sans tracking-tight text-fg-1 t-num">404</h1>
        <p className="text-fg-2 text-body">
          A rota solicitada não existe ou foi movida.
        </p>

        <Link href="/" className="block pt-2">
          <Button fullWidth>Voltar ao dashboard</Button>
        </Link>
      </Card>
    </div>
  )
}
