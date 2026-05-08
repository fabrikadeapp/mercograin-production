import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { WhatsAppContent } from './_components/WhatsAppContent'

export const dynamic = 'force-dynamic'

export default async function WhatsAppPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/login')
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Comunicação · WhatsApp"
        title="WhatsApp Bot"
        subtitle="Envio de mensagens via Evolution API. Conecte sua conta escaneando o QR Code abaixo."
        search={false}
      />
      <WhatsAppContent />
    </AppShell>
  )
}
