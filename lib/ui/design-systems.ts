/**
 * BH Grain — Catálogo de Design Systems selecionáveis pela corretora.
 *
 * Cada workspace escolhe 1 destes temas (campo `Workspace.designSystem`).
 * O slug é aplicado como `data-theme="<slug>"` no <html> via SSR (app/layout.tsx),
 * e os tokens visuais correspondentes vivem em `styles/tokens.css`.
 *
 * Fonte de verdade dos valores de cor: protótipo `docs/design-systems-25.html`
 * (os 10 selecionados pelo cliente). Aqui ficam apenas os metadados usados pela
 * UI de seleção e pela validação de slug.
 *
 * IMPORTANTE: ao adicionar/remover um tema aqui, mantenha em sincronia o bloco
 * `[data-theme="<slug>"]` em styles/tokens.css.
 */

export type DesignSystemSlug =
  | 'lime'
  | 'terminal'
  | 'linen'
  | 'cognac'
  | 'frost'
  | 'graphite'
  | 'paper'
  | 'aurora'
  | 'sand'
  | 'arctic';

export interface DesignSystem {
  slug: DesignSystemSlug;
  /** Nº de referência no catálogo de protótipos (design-systems-25.html). */
  ref: string;
  name: string;
  tagline: string;
  /** dark = tema escuro, light = tema claro (afeta color-scheme e contraste). */
  mode: 'dark' | 'light';
  /** Pares tipográficos (apenas informativo na UI). */
  fonts: string;
  /** Swatches para o card de preview: [bg, surface, accent, accent2, signal]. */
  swatches: [string, string, string, string, string];
}

export const DESIGN_SYSTEMS: DesignSystem[] = [
  {
    slug: 'lime',
    ref: '01',
    name: 'Lime Noir',
    tagline: 'Dark sofisticado com accent lime — o tema atual, refinado.',
    mode: 'dark',
    fonts: 'Inter · JetBrains Mono',
    swatches: ['#0A0B0E', '#14171D', '#C8F051', '#7FA8FF', '#4ADE80'],
  },
  {
    slug: 'terminal',
    ref: '03',
    name: 'Terminal Amber',
    tagline: 'Estética de pregão, densa e técnica, em âmbar.',
    mode: 'dark',
    fonts: 'IBM Plex Sans · IBM Plex Mono',
    swatches: ['#0B0E12', '#11161D', '#FF8A3D', '#3DDC97', '#FF5C5C'],
  },
  {
    slug: 'linen',
    ref: '05',
    name: 'Linen Light',
    tagline: 'Claro premium, papel & tinta, verde escuro.',
    mode: 'light',
    fonts: 'Inter · Spline Mono',
    swatches: ['#F4F1EA', '#FFFFFF', '#1F6B4A', '#B45309', '#1F6B4A'],
  },
  {
    slug: 'cognac',
    ref: '06',
    name: 'Cognac Premium',
    tagline: 'Luxo discreto de private banking — grafite & ouro.',
    mode: 'dark',
    fonts: 'Libre Franklin · Newsreader',
    swatches: ['#16151A', '#1E1D24', '#D4A017', '#C9B896', '#5E9B7E'],
  },
  {
    slug: 'frost',
    ref: '11',
    name: 'Frost Light',
    tagline: 'Claro azul gelo, limpo e confiável.',
    mode: 'light',
    fonts: 'Lexend · DM Mono',
    swatches: ['#F2F5F9', '#FFFFFF', '#2563EB', '#0E7490', '#16A34A'],
  },
  {
    slug: 'graphite',
    ref: '13',
    name: 'Graphite Flat',
    tagline: 'Minimalismo cinza, flat, alto foco.',
    mode: 'dark',
    fonts: 'Public Sans · Martian Mono',
    swatches: ['#121212', '#1A1A1A', '#E6E6E6', '#9CA3AF', '#4ADE80'],
  },
  {
    slug: 'paper',
    ref: '15',
    name: 'Paper Slate',
    tagline: 'Claro neutro, branco & ardósia, sóbrio.',
    mode: 'light',
    fonts: 'Geist · Geist Mono',
    swatches: ['#FAFAFA', '#FFFFFF', '#18181B', '#3B82F6', '#16A34A'],
  },
  {
    slug: 'aurora',
    ref: '16',
    name: 'Violet Aurora',
    tagline: 'Gradientes vivos roxo/teal, moderno.',
    mode: 'dark',
    fonts: 'Space Grotesk · JetBrains Mono',
    swatches: ['#0B0A14', '#1A1726', '#7C5CFF', '#2DD4BF', '#FF6AC2'],
  },
  {
    slug: 'sand',
    ref: '17',
    name: 'Sand Stone',
    tagline: 'Claro quente cor de areia, acolhedor.',
    mode: 'light',
    fonts: 'DM Sans · DM Mono',
    swatches: ['#F5F0E8', '#FFFCF7', '#A8521C', '#1F6B4A', '#1A1714'],
  },
  {
    slug: 'arctic',
    ref: '25',
    name: 'Arctic Mono',
    tagline: 'Claro branco com azul aço, corporativo.',
    mode: 'light',
    fonts: 'Instrument Sans · JetBrains Mono',
    swatches: ['#F7F9FB', '#FFFFFF', '#0F62FE', '#0D9488', '#0F172A'],
  },
];

export const DEFAULT_DESIGN_SYSTEM: DesignSystemSlug = 'lime';

const SLUGS = new Set(DESIGN_SYSTEMS.map((d) => d.slug));

/** Valida e normaliza um slug vindo do DB/form. Faz fallback para o default. */
export function normalizeDesignSystem(value: unknown): DesignSystemSlug {
  if (typeof value === 'string') {
    // Compat: tema legado 'phb' (NewDB v2) === 'lime'.
    if (value === 'phb') return 'lime';
    if (SLUGS.has(value as DesignSystemSlug)) return value as DesignSystemSlug;
  }
  return DEFAULT_DESIGN_SYSTEM;
}

export function isValidDesignSystem(value: unknown): value is DesignSystemSlug {
  return typeof value === 'string' && SLUGS.has(value as DesignSystemSlug);
}

export function getDesignSystem(slug: DesignSystemSlug): DesignSystem {
  return DESIGN_SYSTEMS.find((d) => d.slug === slug) ?? DESIGN_SYSTEMS[0];
}
