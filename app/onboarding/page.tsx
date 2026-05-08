import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { getActiveWorkspace } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  // Se já tem workspace, mandamos pro dashboard.
  const ws = await getActiveWorkspace(session.user.id)
  if (ws) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-bg-2 border border-border-1 rounded-card p-8 text-center">
        <h1 className="text-h2 mb-3 text-fg-1">Onboarding em breve</h1>
        <p className="text-fg-2 mb-6">
          Sua conta foi criada mas ainda não tem um workspace ativo. O assistente
          de configuração vai cuidar disso em breve. Por enquanto, fale com o
          suporte para ativar manualmente.
        </p>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/auth/login' })
          }}
        >
          <button
            type="submit"
            className="px-4 py-2 rounded-pill bg-bg-3 text-fg-1 hover:bg-bg-4 transition"
          >
            Sair
          </button>
        </form>
        <div className="mt-4">
          <Link href="/contato" className="text-accent text-sm hover:underline">
            Falar com suporte
          </Link>
        </div>
      </div>
    </main>
  )
}
