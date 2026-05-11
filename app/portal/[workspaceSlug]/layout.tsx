import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { workspaceSlug: string }
}) {
  // Login e setup tem seu próprio layout (rendered via children). Quando
  // tiver cookie, decoramos com header. Pra páginas públicas sem cookie
  // ainda renderizamos children, mas sem header.
  const session = await getPortalSession()
  if (!session) {
    return <div className="min-h-screen bg-gray-50">{children}</div>
  }

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: { nome: true, workspaceId: true },
  })
  const ws = await db.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { slug: true, name: true },
  })
  if (!cliente || !ws || ws.slug !== params.workspaceSlug) {
    redirect(`/portal/${params.workspaceSlug}/login`)
  }
  const base = `/portal/${ws.slug}`
  const nav = [
    ['Dashboard', `${base}`],
    ['Contratos', `${base}/contratos`],
    ['Fixações', `${base}/fixacoes`],
    ['Recebíveis', `${base}/recebiveis`],
    ['Cotações', `${base}/cotacoes`],
    ['Documentos', `${base}/documentos`],
    ['Chat', `${base}/chat`],
    ['Educacional', `${base}/educacional`],
  ]
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm text-gray-500">{ws.name}</div>
            <div className="font-medium">{cliente.nome}</div>
          </div>
          <form action="/api/portal/logout" method="post">
            <button className="text-sm text-red-600 hover:underline" type="submit">
              Sair
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="text-gray-700 hover:text-black">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
