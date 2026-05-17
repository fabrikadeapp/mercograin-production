import Link from 'next/link'
import { signOut } from '@/auth'

export const dynamic = 'force-dynamic'

export default function SemAcessoPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="max-w-md text-center space-y-4">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-2)' }}
        >
          <span style={{ fontSize: 24 }}>🔒</span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>
          Sem acesso às áreas
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Seu usuário ainda não tem nenhuma área liberada nesta licença. Peça
          para o administrador do workspace liberar Mesa, Financeiro, Fiscal
          ou Gestão para o seu acesso.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/auth/login' })
            }}
          >
            <button
              type="submit"
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Sair do sistema
            </button>
          </form>
          <Link
            href="/perfil"
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0a0a' }}
          >
            Meu perfil
          </Link>
        </div>
      </div>
    </div>
  )
}
