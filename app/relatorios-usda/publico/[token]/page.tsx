/**
 * app/relatorios-usda/publico/[token]/page.tsx
 *
 * Página PÚBLICA do Relatório USDA (SEM auth) — acessível por link HMAC
 * gerado em POST /api/relatorios-usda/[id]/share. É o que o cliente do cliente
 * (produtor) vê quando a corretora compartilha o relatório por WhatsApp/email.
 *
 * Fluxo:
 *  1. Valida o token HMAC (lib/usda/share-token → validarTokenRelatorio).
 *     Inválido/expirado → página de erro amigável (sem vazar detalhes).
 *  2. Carrega o RelatorioUsda do banco (db.relatorioUsda.findUnique).
 *  3. Resolve o branding do workspace (DadosEmpresa: logo + nome), com logo
 *     em URL absoluta para renderizar corretamente em qualquer origem.
 *  4. Renderiza o RelatorioView (mesmo visual da preview interna — DRY) com
 *     rodapé "Powered by Mercograin" e a fonte USDA.
 *
 * Como é página pública compartilhada, força render dinâmico e expõe metadata
 * básica para preview de link.
 */

import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { validarTokenRelatorio } from '@/lib/usda/share-token'
import type { RelatorioUsda } from '@/lib/usda/relatorio'
import { RelatorioView } from '../../_components/RelatorioView'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Relatório USDA · Mercograin',
  description: 'Projeções USDA de Soja e Milho — relatório de mercado.',
  robots: { index: false, follow: false },
}

/** Resolve a origem (protocolo + host) a partir dos headers da request. */
function origemAtual(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

/** Converte um logoUrl (pode ser relativo) em URL absoluta. */
function logoAbsoluto(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null
  if (/^https?:\/\//.test(logoUrl)) return logoUrl
  if (logoUrl.startsWith('/')) {
    const origem = origemAtual()
    return origem ? `${origem}${logoUrl}` : logoUrl
  }
  return logoUrl
}

/** Casca visual compartilhada (fundo + container centralizado). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen w-full px-4 py-10"
      style={{ background: 'var(--bg-1)' }}
    >
      <div className="mx-auto w-full max-w-4xl">{children}</div>
    </main>
  )
}

/** Rodapé discreto "Powered by Mercograin". */
function PoweredBy() {
  return (
    <div className="mt-8 flex items-center justify-center">
      <a
        href="/"
        className="text-small text-fg-3 hover:text-accent transition-colors"
      >
        Powered by{' '}
        <span className="font-semibold" style={{ color: 'var(--accent)' }}>
          Mercograin
        </span>
      </a>
    </div>
  )
}

/** Página de erro amigável (token inválido/expirado/relatório ausente). */
function PaginaErro({
  titulo,
  mensagem,
}: {
  titulo: string
  mensagem: string
}) {
  return (
    <Shell>
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="eyebrow">Relatório USDA</p>
        <h1 className="text-h2 mt-1 font-semibold text-fg-1">{titulo}</h1>
        <p className="text-body mt-3 text-fg-2">{mensagem}</p>
        <p className="text-small mt-6 text-fg-3">
          Se você recebeu este link de uma corretora, peça um novo link
          atualizado.
        </p>
      </div>
      <PoweredBy />
    </Shell>
  )
}

export default async function RelatorioUsdaPublicoPage({
  params,
}: {
  params: { token: string }
}) {
  // 1. Valida o token HMAC
  const validacao = validarTokenRelatorio(params.token)

  if (!validacao.relatorioId) {
    return (
      <PaginaErro
        titulo="Link inválido"
        mensagem="Este link de relatório não é válido. Verifique se você copiou o endereço completo."
      />
    )
  }

  if (validacao.expirado) {
    return (
      <PaginaErro
        titulo="Link expirado"
        mensagem="Este link de relatório expirou e não está mais disponível."
      />
    )
  }

  if (!validacao.valid) {
    return (
      <PaginaErro
        titulo="Link indisponível"
        mensagem="Não foi possível abrir este relatório."
      />
    )
  }

  // 2. Carrega o relatório
  let registro: {
    dados: unknown
    titulo: string
    workspaceId: string
  } | null = null
  try {
    registro = await db.relatorioUsda.findUnique({
      where: { id: validacao.relatorioId },
      select: { dados: true, titulo: true, workspaceId: true },
    })
  } catch (err) {
    console.error('[relatorios-usda/publico] erro ao carregar relatório:', err)
    return (
      <PaginaErro
        titulo="Erro ao carregar"
        mensagem="Ocorreu um erro ao abrir o relatório. Tente novamente em instantes."
      />
    )
  }

  if (!registro) {
    return (
      <PaginaErro
        titulo="Relatório não encontrado"
        mensagem="O relatório associado a este link não está mais disponível."
      />
    )
  }

  const relatorio = registro.dados as unknown as RelatorioUsda
  if (!relatorio || !Array.isArray(relatorio.secoes)) {
    return (
      <PaginaErro
        titulo="Relatório indisponível"
        mensagem="Os dados deste relatório não puderam ser exibidos."
      />
    )
  }

  // 3. Branding do workspace (logo + nome)
  const empresa = await db.dadosEmpresa.findFirst({
    where: { workspaceId: registro.workspaceId },
    select: { logoUrl: true, razaoSocial: true, nomeFantasia: true },
  })

  const brandNome =
    empresa?.nomeFantasia || empresa?.razaoSocial || null
  const brandLogoUrl = logoAbsoluto(empresa?.logoUrl)

  // 4. Renderiza
  return (
    <Shell>
      <article className="card p-6 sm:p-8">
        <RelatorioView
          relatorio={relatorio}
          brandLogoUrl={brandLogoUrl}
          brandNome={brandNome}
        />
      </article>
      <PoweredBy />
    </Shell>
  )
}
