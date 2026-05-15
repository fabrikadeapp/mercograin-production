import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { listAllForWorkspace } from '@/lib/bhgrain/credentials'
import { isCentralEvolutionEnabled } from '@/lib/whatsapp/evolution-central'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { InstagramForm, DeleteChannelButton } from './_ui'
import { EmailAccountsCard } from './_email-accounts-ui'
import { WhatsappAccountsCard } from './_whatsapp-accounts-ui'

export const dynamic = 'force-dynamic'

export default async function IntegracoesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  // Permite owner/admin do workspace ou admin global
  const allowed = scope.isAdmin || ['owner', 'admin'].includes(scope.workspaceRole)
  if (!allowed) redirect('/dashboard')

  const [creds, whatsModeRow] = await Promise.all([
    listAllForWorkspace(scope.workspaceId),
    db.systemConfig.findUnique({ where: { key: 'bhgrain.whatsapp.mode' } }),
  ])

  const whatsModeValue = (whatsModeRow?.value as { mode?: string; centralBaseUrl?: string } | null) ?? null
  const whatsMode = (whatsModeValue?.mode ?? 'hybrid').toLowerCase() as 'central' | 'byo' | 'hybrid'

  return (
    <AppShell>
      <PageHeader
        eyebrow="BH Grain · Workspace"
        title="Integrações"
        subtitle="Conecte e-mail, Instagram e WhatsApp do seu workspace. Senhas/tokens são criptografados em repouso (AES-256-GCM)."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold">E-mail (IMAP + SMTP)</h2>
              <p className="text-xs opacity-70 mt-1">
                Conecte uma ou mais caixas — Gmail, Outlook, Hotmail ou qualquer servidor próprio.
                Senhas são criptografadas em repouso. Inbox unificado combina todas.
              </p>
            </div>
            <div className="text-[11px] opacity-60">
              {creds.emails.length} {creds.emails.length === 1 ? 'conta conectada' : 'contas conectadas'}
            </div>
          </div>
          <EmailAccountsCard accounts={creds.emails} />
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold mb-1">Instagram</h2>
          <p className="text-xs opacity-70 mb-3">
            Use o <strong>Page Access Token</strong> da página Facebook vinculada à sua conta Instagram Business/Creator. Não pedimos sua senha — siga o passo a passo abaixo do formulário.
          </p>
          <InstagramForm initial={creds.instagram} />
          {creds.instagram && (
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
              <DeleteChannelButton channel="instagram" />
            </div>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold">WhatsApp</h2>
              <p className="text-xs opacity-70 mt-1">
                Conecte WhatsApp Business de graça via QR code (Baileys + Evolution).
                Pode adicionar mais de um número (vendas, suporte, etc).
                {whatsModeValue?.centralBaseUrl
                  ? ' Servidor central provisionado pela BH Grain.'
                  : ''}
              </p>
            </div>
            <div className="text-[11px] opacity-60">
              {creds.whatsapps.length} {creds.whatsapps.length === 1 ? 'conta conectada' : 'contas conectadas'}
            </div>
          </div>
          <WhatsappAccountsCard
            accounts={creds.whatsapps.map((c) => ({
              id: c.id,
              provider: c.provider,
              displayName: c.displayName,
              identifier: c.identifier,
              config: c.config,
              enabled: c.enabled,
              lastTestedAt: c.lastTestedAt,
              lastTestSuccess: c.lastTestSuccess,
              lastTestError: c.lastTestError,
            }))}
            centralAvailable={isCentralEvolutionEnabled()}
          />
        </Card>
      </div>

      <Card className="p-4 mt-4 text-xs opacity-70">
        <h3 className="font-semibold mb-1 opacity-100">Segurança</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Senhas e tokens são criptografados em repouso com AES-256-GCM, com chave-mestra em variável de ambiente.</li>
          <li>Após salvar, os segredos <strong>nunca</strong> voltam em respostas HTTP — só são usados internamente por workers de ingestão.</li>
          <li>Cada workspace acessa apenas suas próprias credenciais. Multi-tenant isolado.</li>
          <li>O super-admin global vê quais workspaces têm credenciais cadastradas, mas <strong>não</strong> consegue ler segredos.</li>
        </ul>
      </Card>
    </AppShell>
  )
}
