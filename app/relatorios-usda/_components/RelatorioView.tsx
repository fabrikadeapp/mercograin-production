/**
 * app/relatorios-usda/_components/RelatorioView.tsx
 *
 * Componente PURO de visualização de um RelatorioUsda (server-compatible, sem
 * estado e sem fetch). Espelha o layout do PDF (lib/usda/relatorio-pdf.tsx):
 * cabeçalho com logo/nome do workspace, título + mês de referência, e uma
 * tabela densa estilo "USDA Projeções" por seção (Mundo / EUA / Brasil +
 * Argentina, por grão) com variações mensal e anual coloridas (verde=up,
 * vermelho=down) e setas ↑/↓/→.
 *
 * Reusado tanto na preview interna quanto na página pública compartilhada,
 * para garantir DRY (uma única fonte do visual do relatório).
 *
 * Usa os tokens de cor do design system (text-fg-*, var(--accent), var(--success),
 * var(--danger), var(--grain-*), var(--bg-*), var(--border)). Não inventa classes.
 */

import type {
  RelatorioUsda,
  LinhaRelatorio,
  SecaoRelatorio,
  Seta,
} from '@/lib/usda/relatorio'

/** Formata número (milhões de toneladas / produtividade) em pt-BR. */
function fmtNum(valor: number | null): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Formata variação percentual com sinal. */
function fmtPct(pct: number | null): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—'
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

/** Símbolo da seta. */
function simboloSeta(seta: Seta): string {
  if (seta === 'up') return '↑'
  if (seta === 'down') return '↓'
  return '→'
}

/** Cor (token CSS) associada à seta. */
function corSeta(seta: Seta): string {
  if (seta === 'up') return 'var(--success)'
  if (seta === 'down') return 'var(--danger)'
  return 'var(--fg-3)'
}

/** Variante de grão para a barra colorida da seção. */
function corGrao(grao: SecaoRelatorio['grao']): string {
  return grao === 'soja' ? 'var(--grain-soja)' : 'var(--grain-milho)'
}

/** Célula de variação: seta colorida + percentual. */
function CelulaVariacao({ pct, seta }: { pct: number | null; seta: Seta }) {
  if (pct === null) {
    return <span className="text-fg-3">—</span>
  }
  return (
    <span className="font-semibold tabular-nums" style={{ color: corSeta(seta) }}>
      <span aria-hidden>{simboloSeta(seta)}</span> {fmtPct(pct)}
    </span>
  )
}

/** Uma linha (métrica) da tabela. */
function LinhaTabela({ linha }: { linha: LinhaRelatorio }) {
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-3 py-2 text-small font-medium text-fg-1 whitespace-nowrap">
        {linha.rotulo}
      </td>
      <td className="px-3 py-2 text-small text-right tabular-nums text-fg-1">
        {fmtNum(linha.atual)}
      </td>
      <td className="px-3 py-2 text-small text-right tabular-nums text-fg-3">
        {fmtNum(linha.anterior)}
      </td>
      <td className="px-3 py-2 text-small text-right whitespace-nowrap">
        <CelulaVariacao pct={linha.variacaoMensal} seta={linha.setaMensal} />
      </td>
      <td className="px-3 py-2 text-small text-right tabular-nums text-fg-3">
        {fmtNum(linha.safraPassada)}
      </td>
      <td className="px-3 py-2 text-small text-right whitespace-nowrap">
        <CelulaVariacao pct={linha.variacaoAnual} seta={linha.setaAnual} />
      </td>
    </tr>
  )
}

/** Tabela densa de uma seção (grão × região). */
function TabelaSecao({ secao }: { secao: SecaoRelatorio }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-2)]">
      <div
        className="flex items-center gap-2 px-3 py-2 text-small font-semibold text-fg-1"
        style={{ borderLeft: `3px solid ${corGrao(secao.grao)}` }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: corGrao(secao.grao) }}
        />
        {secao.titulo}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-[var(--border)] bg-[var(--bg-1)]">
              <th className="px-3 py-2 text-left text-small font-semibold text-fg-2">
                Métrica
              </th>
              <th className="px-3 py-2 text-right text-small font-semibold text-fg-2">
                USDA atual
              </th>
              <th className="px-3 py-2 text-right text-small font-semibold text-fg-2">
                Mês anterior
              </th>
              <th className="px-3 py-2 text-right text-small font-semibold text-fg-2">
                Var. mensal
              </th>
              <th className="px-3 py-2 text-right text-small font-semibold text-fg-2">
                Safra passada
              </th>
              <th className="px-3 py-2 text-right text-small font-semibold text-fg-2">
                Var. anual
              </th>
            </tr>
          </thead>
          <tbody>
            {secao.linhas.map((linha, i) => (
              <LinhaTabela key={i} linha={linha} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export interface RelatorioViewProps {
  relatorio: RelatorioUsda
  /** Branding do workspace (corretora). */
  brandLogoUrl?: string | null
  brandNome?: string | null
}

/**
 * Visualização completa do relatório (cabeçalho + seções + rodapé com fonte).
 * Componente puro reusável — não inclui o "Powered by Mercograin" (esse é
 * responsabilidade do container público, que decide se exibe).
 */
export function RelatorioView({
  relatorio,
  brandLogoUrl,
  brandNome,
}: RelatorioViewProps) {
  return (
    <div className="space-y-6">
      {/* Cabeçalho: branding (esq) + título/mês (dir) */}
      <header
        className="flex flex-col gap-4 border-b-2 pb-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderBottomColor: 'var(--accent)' }}
      >
        <div className="flex items-center gap-3">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt={brandNome ?? 'Logo'}
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          ) : brandNome ? (
            <span className="text-h3 font-semibold text-fg-1">{brandNome}</span>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className="eyebrow">Relatório de mercado</p>
          <h1 className="text-h2 font-semibold tracking-tight text-fg-1">
            {relatorio.titulo}
          </h1>
          {relatorio.mesReferencia ? (
            <p className="text-small text-fg-3 mt-1">
              Mês de referência: {relatorio.mesReferencia}
            </p>
          ) : null}
        </div>
      </header>

      {/* Seções */}
      <div className="space-y-4">
        {relatorio.secoes.map((secao, idx) => (
          <TabelaSecao key={idx} secao={secao} />
        ))}
      </div>

      {/* Fonte */}
      <footer className="border-t border-[var(--border)] pt-4 text-small text-fg-3">
        <p>Fonte: {relatorio.fonte || 'USDA'}</p>
        {relatorio.geradoEm ? (
          <p className="mt-0.5">Gerado em {relatorio.geradoEm}</p>
        ) : null}
      </footer>
    </div>
  )
}
