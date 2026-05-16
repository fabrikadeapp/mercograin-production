import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { listAllForWorkspace } from '@/lib/bhgrain/credentials'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { InstagramForm, DeleteChannelButton } from './_ui'
import { EmailAccountsCard } from './_email-accounts-ui'

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
              <h2 className="text-base font-semibold">WhatsApp Business</h2>
              <p className="text-xs opacity-70 mt-1">
                Receba e responda mensagens do WhatsApp direto no seu Inbox unificado.
              </p>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--warning)' }}>
              ⚙ Em adequação para Cloud API
            </div>
          </div>
          <div
            style={{
              padding: 16,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--text-mute)',
              lineHeight: 1.6,
            }}
          >
            <p className="mb-2">
              <strong style={{ color: 'var(--text)' }}>Migrando para WhatsApp Cloud API oficial Meta.</strong>
            </p>
            <p className="mb-2">
              A integração gratuita via QR code (Baileys) foi descontinuada porque o WhatsApp passou a
              rejeitar protocolos não-oficiais. Estamos finalizando a integração via Cloud API oficial
              que oferece mais estabilidade, deliverability garantida e suporte a templates aprovados.
            </p>
            <p className="mb-1">
              <strong style={{ color: 'var(--text)' }}>O que vai mudar:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs">
              <li>Cadastro de número no Meta Business Manager (1x apenas)</li>
              <li>Free tier: 1.000 conversas/mês de graça</li>
              <li>Acima disso: ~R$ 0,03 por mensagem de marketing, R$ 0,02 por utilidade</li>
              <li>Conversas iniciadas pelo cliente são sempre gratuitas (24h)</li>
            </ul>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
              Aguarde a conclusão. Enquanto isso, configure suas contas de e-mail acima.
            </p>
          </div>
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
