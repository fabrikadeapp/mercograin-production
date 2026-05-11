import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'
import { db as prisma } from '@/lib/db'
import { CalculadoraContent } from '../calculadora/_components/CalculadoraContent'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: {
    from?: string
    id?: string
    preco?: string
    quantidade?: string
    grao?: string
  }
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  let comissaoPadrao = 1.5
  try {
    const userId = (session.user as { id?: string }).id
    if (userId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: { include: { empresa: true } } },
      })
      const empresa = member?.workspace?.empresa as
        | { comissaoPadrao?: number | null }
        | null
        | undefined
      const c = empresa?.comissaoPadrao
      if (typeof c === 'number') comissaoPadrao = c
    }
  } catch {
    /* default */
  }

  const presetGrao =
    searchParams?.grao === 'milho' ||
    searchParams?.grao === 'trigo' ||
    searchParams?.grao === 'soja'
      ? searchParams.grao
      : 'soja'

  const preset = {
    grao: presetGrao as 'soja' | 'milho' | 'trigo',
    precoBrutoSc: searchParams?.preco ? Number(searchParams.preco) : undefined,
    quantidadeSc: searchParams?.quantidade ? Number(searchParams.quantidade) : undefined,
    fromProposta: searchParams?.from === 'proposta' ? searchParams?.id ?? null : null,
  }

  return (
    <VgAppShell>
      <VgPageHeader
        eyebrow="Mesa · Ferramenta"
        title="Calculadora de Preço Líquido"
        subtitle="Líquido ao produtor com toggles para frete, comissão, FUNRURAL, classificação, armazenagem e ICMS."
      />
      <CalculadoraContent comissaoPadrao={comissaoPadrao} preset={preset} />
    </VgAppShell>
  )
}
