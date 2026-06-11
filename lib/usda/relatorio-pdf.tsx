/**
 * lib/usda/relatorio-pdf.tsx
 *
 * Componente @react-pdf/renderer que renderiza um RelatorioUsda como tabela
 * densa estilo "USDA Projeções": logo do workspace no topo, título, mês de
 * referência, seções (Mundo / EUA / Brasil + Argentina) e linhas com colunas
 * (rótulo, atual, anterior, variação mensal %, safra passada, variação anual %).
 *
 * As setas ↑/↓ são representadas por cor (verde=up, vermelho=down) + símbolo.
 * Rodapé "Fonte: USDA · Mercograin".
 *
 * Este é o componente puro de apresentação — não faz fetch nem acessa banco.
 * O caller (route) resolve o branding e renderiza via renderToBuffer/Stream.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import React from 'react'
import type { RelatorioUsda, LinhaRelatorio, Seta } from './relatorio'

// Paleta
const VERDE = '#16a34a'
const VERMELHO = '#dc2626'
const ACCENT_ESCURO = '#3f5d0a' // accent (#C8F051) escurecido p/ contraste em papel
const CINZA_HEADER = '#f3f4f6'
const CINZA_BORDA = '#d1d5db'
const CINZA_LINHA = '#e5e7eb'
const CINZA_TEXTO = '#666666'
const PRETO = '#111827'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PRETO,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT_ESCURO,
    paddingBottom: 10,
  },
  headerEsq: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 90,
    height: 42,
    marginRight: 12,
    objectFit: 'contain',
  },
  brandNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ACCENT_ESCURO,
  },
  headerDir: {
    alignItems: 'flex-end',
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ACCENT_ESCURO,
  },
  mesRef: {
    fontSize: 10,
    color: CINZA_TEXTO,
    marginTop: 4,
  },
  secao: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: CINZA_LINHA,
  },
  secaoTitulo: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: ACCENT_ESCURO,
    padding: 6,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: CINZA_HEADER,
    borderBottomWidth: 1,
    borderBottomColor: CINZA_BORDA,
  },
  th: {
    fontSize: 8,
    fontWeight: 'bold',
    padding: 5,
    color: PRETO,
  },
  tr: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: CINZA_LINHA,
  },
  td: {
    fontSize: 8,
    padding: 5,
  },
  // Larguras das colunas (somam 100%)
  colRotulo: { width: '24%' },
  colNum: { width: '15%', textAlign: 'right' },
  colVar: { width: '17%', textAlign: 'right' },
  rodape: {
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CINZA_LINHA,
    fontSize: 8,
    color: CINZA_TEXTO,
    textAlign: 'center',
  },
})

/**
 * Mescla múltiplos objetos de estilo em um só. Evitamos arrays de estilo no
 * `style` (idiomático no @react-pdf em runtime, mas o tipo do React.createElement
 * resolve para a overload de SVG e quebra o typecheck).
 */
function mesclar(...estilos: Array<Style | undefined>): Style {
  return Object.assign({}, ...estilos)
}

/** Símbolo da seta (a cor é aplicada separadamente). */
function simboloSeta(seta: Seta): string {
  if (seta === 'up') return '↑' // ↑
  if (seta === 'down') return '↓' // ↓
  return '→' // → (flat)
}

/** Cor associada à seta. */
function corSeta(seta: Seta): string {
  if (seta === 'up') return VERDE
  if (seta === 'down') return VERMELHO
  return CINZA_TEXTO
}

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

/** Célula de variação: símbolo de seta colorido + percentual. */
function CelulaVariacao({
  pct,
  seta,
  estilo,
}: {
  pct: number | null
  seta: Seta
  estilo: Style
}) {
  const cor = corSeta(seta)
  return React.createElement(
    Text,
    { style: mesclar(styles.td, estilo, { color: cor, fontWeight: 'bold' }) },
    pct === null ? '—' : `${simboloSeta(seta)} ${fmtPct(pct)}`,
  )
}

/** Linha da tabela. */
function LinhaTabela({ linha }: { linha: LinhaRelatorio }) {
  return React.createElement(
    View,
    { style: styles.tr },
    React.createElement(
      Text,
      { style: mesclar(styles.td, styles.colRotulo, { fontWeight: 'bold' }) },
      linha.rotulo,
    ),
    React.createElement(
      Text,
      { style: mesclar(styles.td, styles.colNum) },
      fmtNum(linha.atual),
    ),
    React.createElement(
      Text,
      { style: mesclar(styles.td, styles.colNum, { color: CINZA_TEXTO }) },
      fmtNum(linha.anterior),
    ),
    React.createElement(CelulaVariacao, {
      pct: linha.variacaoMensal,
      seta: linha.setaMensal,
      estilo: styles.colVar,
    }),
    React.createElement(
      Text,
      { style: mesclar(styles.td, styles.colNum, { color: CINZA_TEXTO }) },
      fmtNum(linha.safraPassada),
    ),
    React.createElement(CelulaVariacao, {
      pct: linha.variacaoAnual,
      seta: linha.setaAnual,
      estilo: styles.colVar,
    }),
  )
}

/** Cabeçalho da tabela de uma seção. */
function CabecalhoTabela() {
  return React.createElement(
    View,
    { style: styles.tabHeader },
    React.createElement(Text, { style: mesclar(styles.th, styles.colRotulo) }, 'Métrica'),
    React.createElement(Text, { style: mesclar(styles.th, styles.colNum) }, 'USDA atual'),
    React.createElement(Text, { style: mesclar(styles.th, styles.colNum) }, 'Mês anterior'),
    React.createElement(Text, { style: mesclar(styles.th, styles.colVar) }, 'Var. mensal'),
    React.createElement(Text, { style: mesclar(styles.th, styles.colNum) }, 'Safra passada'),
    React.createElement(Text, { style: mesclar(styles.th, styles.colVar) }, 'Var. anual'),
  )
}

/**
 * Documento PDF do relatório USDA.
 *
 * @param relatorio   estrutura RelatorioUsda já montada (snapshot)
 * @param brandLogoUrl URL absoluta do logo do workspace (opcional)
 * @param brandNome    nome da corretora (fallback quando não há logo)
 */
export function RelatorioUsdaDocument({
  relatorio,
  brandLogoUrl,
  brandNome,
}: {
  relatorio: RelatorioUsda
  brandLogoUrl?: string
  brandNome?: string
}) {
  return React.createElement(
    Document,
    {
      producer: brandNome ?? 'Mercograin',
      creator: brandNome ?? 'Mercograin',
      title: relatorio.titulo,
    },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },

      // Cabeçalho: logo/nome (esq) + título/mês (dir)
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerEsq },
          brandLogoUrl
            ? React.createElement(Image, { src: brandLogoUrl, style: styles.logo })
            : brandNome
              ? React.createElement(Text, { style: styles.brandNome }, brandNome)
              : null,
        ),
        React.createElement(
          View,
          { style: styles.headerDir },
          React.createElement(Text, { style: styles.titulo }, relatorio.titulo),
          relatorio.mesReferencia
            ? React.createElement(
                Text,
                { style: styles.mesRef },
                `Mês de referência: ${relatorio.mesReferencia}`,
              )
            : null,
        ),
      ),

      // Seções (Mundo / EUA / Brasil + Argentina, por grão)
      ...relatorio.secoes.map((secao, idx) =>
        React.createElement(
          View,
          { key: idx, style: styles.secao, wrap: false },
          React.createElement(Text, { style: styles.secaoTitulo }, secao.titulo),
          React.createElement(CabecalhoTabela, null),
          ...secao.linhas.map((linha, i) =>
            React.createElement(LinhaTabela, { key: i, linha }),
          ),
        ),
      ),

      // Rodapé
      React.createElement(
        View,
        { style: styles.rodape },
        React.createElement(
          Text,
          null,
          `Fonte: ${relatorio.fonte || 'USDA'} · Mercograin`,
        ),
        relatorio.geradoEm
          ? React.createElement(
              Text,
              { style: { marginTop: 2 } },
              `Gerado em ${relatorio.geradoEm}`,
            )
          : null,
      ),
    ),
  )
}
