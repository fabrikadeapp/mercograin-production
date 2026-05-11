import { PageHeader } from '@/components/ui/phb'
import { getQuotesConfig, listProviders } from '@/lib/quotes/registry'
import { CotacoesProvidersForm } from './_components/CotacoesProvidersForm'

export const dynamic = 'force-dynamic'

export default async function AdminCotacoesPage() {
  const config = await getQuotesConfig()
  const providers = listProviders().map((p) => ({
    id: p.id,
    displayName: p.displayName,
    supports: [...p.supports],
    isConfigured: p.isConfigured(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · Infraestrutura"
        title="Fontes de cotações"
        subtitle="Escolha qual provider responde por cotações de grãos e câmbio em todo o sistema. Fallbacks rodam em ordem se o primário falhar."
        search={false}
      />
      <CotacoesProvidersForm initialConfig={config} providers={providers} />
    </div>
  )
}
