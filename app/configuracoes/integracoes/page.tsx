import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { listAllForWorkspace } from '@/lib/bhgrain/credentials'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { EmailForm, InstagramForm, WhatsappForm, DeleteChannelButton } from './_ui'

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
        <Card className="p-4">
          <h2 className="text-base font-semibold mb-1">E-mail (IMAP + SMTP)</h2>
          <p className="text-xs opacity-70 mb-3">
            Leitura de inbox via IMAP + envio via SMTP. Compatível com Gmail (com senha de app), Outlook, ProtonMail, servidores corporativos.
          </p>
          <EmailForm initial={creds.email} />
          {creds.email && (
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
              <DeleteChannelButton channel="email_imap_smtp" />
            </div>
          )}
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
          <h2 className="text-base font-semibold mb-1">WhatsApp</h2>
          <p className="text-xs opacity-70 mb-3">
            {whatsMode === 'central' && 'Modo central — sua instância é provisionada automaticamente no servidor BH Grain.'}
            {whatsMode === 'byo' && 'Modo BYO — você fornece o servidor Evolution e a chave de API.'}
            {whatsMode === 'hybrid' && 'Modo híbrido — escolha entre usar o servidor central do BH Grain ou trazer o seu próprio Evolution.'}
          </p>
          <WhatsappForm initial={creds.whatsapp} mode={whatsMode} centralBaseUrl={whatsModeValue?.centralBaseUrl ?? null} />
          {creds.whatsapp && (
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
              <DeleteChannelButton channel="whatsapp" />
            </div>
          )}
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
