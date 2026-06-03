'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'
import { ClienteForm } from '@/components/clientes/ClienteForm'

export default function NovoClientePage() {
  const router = useRouter()

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cadastro · Novo registro"
        title="Novo cliente"
        subtitle="Preencha os dados básicos do cliente ou contraparte comercial."
        search={false}
        actions={
          <Link href="/clientes">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card>
        <ClienteForm onSuccess={() => router.push('/clientes')} />
      </Card>
    </AppShell>
  )
}
