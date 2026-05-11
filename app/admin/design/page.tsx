import { PageHeader } from '@/components/ui/phb'
import { getUiTheme, AVAILABLE_THEMES } from '@/lib/ui/theme'
import { DesignThemeForm } from './_components/DesignThemeForm'

export const dynamic = 'force-dynamic'

export default async function AdminDesignPage() {
  const current = await getUiTheme()
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · Aparência"
        title="Tema de design"
        subtitle="Define qual linguagem visual o software adota globalmente. A mudança vale para todos os workspaces e usuários."
        search={false}
      />
      <DesignThemeForm initialTheme={current} options={AVAILABLE_THEMES} />
    </div>
  )
}
