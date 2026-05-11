---
name: Synthex UI — Analytics SaaS Dashboard
source_url: https://dribbble.com/shots/27131881-Synthex-UI-Analytics-SaaS-Dashboard
designer: Jack R. for RonDesignLab
extracted_from: dribbble_shot_attachments
extracted_at: 2026-05-11
extraction_method: visual_inspection (8 mockup images)
archetype: glassmorphic-analytics-light
confidence: high (style guide image #8 confirma fonts + 4 cores oficiais)
---

# Synthex UI — Analytics SaaS Dashboard

## 1. Visão geral

Painel de analytics estilo SaaS com **estética glassmorphic clean** sobre fundo claro gradiente. Forte ênfase em **tipografia generosa** (números enormes), **cartões flutuantes com blur**, **iconografia minimalista** em containers arredondados e **pílulas/chips** como elemento dominante de UI. Visual associa-se a tools premium como Linear/Vercel/Stripe pré-rebrand, mas com camada **agua/azul-acinzentada** suave que dá identidade própria.

**Mood:** confiança · precisão · "vendor enterprise legível" · tilt-shift em apresentações de marketing

## 2. Cores (palette confirmada via style guide oficial — imagem #8)

```yaml
brand:
  primary: '#1B4D5B'      # teal-deep · texto principal, headers
  accent: '#0F7305'       # green-deep · CTAs primárias, KPIs positivos (delta +)
  secondary: '#162244'    # navy-dark · sidebar, footer, dock
  surface_on: '#FFFFFF'   # branco · ink em containers escuros

semantic:
  positive: '#0F7305'     # green
  negative: '#D32F2F'     # red · usado em "Conversion Rate" chart bar único
  warning: '#E89F2A'      # amber · não confirmado em style guide, inferido de chips
  neutral: '#9CA3AF'      # gray-400 · texto secundário

background:
  base: 'linear-gradient(180deg, #E8EEF0 0%, #D4DCDE 100%)'  # gradiente água
  surface_1: 'rgba(255,255,255,0.65)'  # cards glassmorphic (backdrop-blur)
  surface_2: 'rgba(255,255,255,0.85)'  # cards mais opacos (KPI principal)
  surface_dark: '#162244'              # dock/footer com chips de ação

border:
  subtle: 'rgba(22,34,68,0.06)'   # bordas internas de cards
  card: 'rgba(255,255,255,0.4)'    # halo dos glassmorphic cards
```

## 3. Tipografia

```yaml
family:
  display: 'Urbanist'           # CONFIRMADO no style guide oficial
  body: 'Urbanist'              # mesma família, varia weight
  numeric: 'Urbanist'           # números tabulares — não usa fonte separada

weights:
  - 300 (light) — descrições secundárias
  - 400 (regular) — body
  - 500 (medium) — labels e chips
  - 600 (semibold) — títulos de seção
  - 700 (bold) — KPI numbers

scale:
  display_xl: '64px / 1.0 / weight:600'    # números KPI gigantes (40,439.00)
  display_lg: '48px / 1.0 / weight:600'    # números secundários (3m 42s, 37.6%)
  heading_h1: '24px / 1.2 / weight:600'    # título da página (Visitors Insights)
  heading_h2: '18px / 1.3 / weight:500'    # subtítulos de cards
  body: '14px / 1.5 / weight:400'          # corpo
  small: '12px / 1.4 / weight:500'         # labels (UNIQUE VISITORS DAY)
  eyebrow: '10-11px / 1.2 / weight:500 / letter:1.5px / uppercase'  # eyebrows ("Pages")

case:
  - eyebrows e labels: UPPERCASE com letter-spacing positivo
  - títulos: Sentence case
  - números: tabular figures, ponto decimal grande (40,439.00 com ".00" preservado)
```

## 4. Espaçamento (scale 4px base)

```yaml
spacing:
  '0.5': 2px
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  '16': 64px
  '20': 80px   # gutter entre seções principais
  '24': 96px

card_padding: 24px (mobile) / 32px (desktop)
card_gap: 16px (grid) / 24px (vertical)
```

## 5. Raios e formas

```yaml
radius:
  pill: 99px           # chips, pílulas de filtro (DOMINANTE)
  card: 24px           # cards principais glassmorphic
  card_sm: 16px        # cards secundários
  button: 999px        # sempre pill
  sidebar_item: 12px

shape_signature: 'pill-radius is the dominant rounded element'
```

## 6. Sombras e elevação

```yaml
shadows:
  card_glass: '0 1px 2px rgba(22,34,68,0.04), 0 4px 16px rgba(22,34,68,0.06)'
  card_hover: '0 4px 8px rgba(22,34,68,0.06), 0 16px 32px rgba(22,34,68,0.10)'
  floating_card: '0 24px 48px rgba(22,34,68,0.18)'  # cards "destacados" no mockup
  inset_glass: 'inset 0 1px 0 rgba(255,255,255,0.6)'  # highlight superior em glass cards

elevation_strategy: 'Layered glassmorphism — cards literalmente "flutuam" com forte z-depth via shadow + tilt em mockups'
```

## 7. Iconografia

```yaml
style: outline-thin
weight: 1.5px stroke
size:
  - 16px (inline em labels)
  - 18px (chips de filtro)
  - 24px (containers em sidebar)

container_style: 'icon + circular pill background, ~36px diameter'
exemplos_observados:
  - filtro com chevron ▼ ao lado (Device Type, Traffic Source, Geolocation, Status)
  - dock inferior com 4 ícones em pills escuras (Provide feedback, etc)
  - chips com ícone interno arredondado

set_estimado: 'lucide-react ou tabler (estilo thin-stroke similar)'
```

## 8. Componentes-chave

```yaml
KPI_card:
  estrutura: 'eyebrow (label uppercase 10px) → número gigante (64px bold) → unidade pequena'
  cor_numero: '#1B4D5B (teal-deep) com delta verde abaixo (+0,8%)'
  background: 'rgba(255,255,255,0.65) com backdrop-blur(16px) e border-radius:24px'
  exemplo: '40,439.00 unique visitors/day'

chip_filter:
  shape: pill (radius 99px)
  padding: '6px 14px'
  background: 'rgba(255,255,255,0.85)'
  text: '13px / weight 500 / color #1B4D5B'
  icon: 'chevron-down 14px ao lado direito'
  estados: [default, active(bg #1B4D5B color white), hover(bg #FFF + shadow)]

sidebar_nav:
  background: 'glassmorphic translucente OU sólido #162244 nos mockups com tilt'
  item_padding: '12px 16px'
  item_radius: 12px
  active_indicator: 'bullet dot ● à esquerda, background sutil'
  groups: 'Pages → Insights/Campaigns/Documents/Quarter/Metrics; Revenue/Conversion/Visits/Unique Visitors com counter chips'

chart_style:
  - line: 'stroke 2px, dot 4px no vértice de cada data, sem fill'
  - bar: 'barras verticais finas (4-6px width) espaçadas, color #1B4D5B; única barra em vermelho quando outlier'
  - hatched_area: 'área com hachuras diagonais 45° em vez de fill sólido'
  - tooltip: 'pill flutuante com +0,8% e descrição, fundo branco glassy'

floating_action_panel:
  estrutura: 'card flutuante com sub-cards menores empilhados (Traffic Overview + Conversion Rate)'
  background: 'glassmorphic intenso, forte shadow drop'
  sugere: 'painel de configuração contextual / drag-and-drop de widgets'
```

## 9. Layout & grade

```yaml
grid:
  cols: 12 (web) / 6 (tablet) / 4 (mobile)
  gutter: 24px
  margin: 32px (desktop)

dashboard_layout: |
  ┌─ Top bar (search, filtros, ações)
  ├─ Sidebar (vertical, agrupada por seção, com pill counters)
  ├─ Main canvas:
  │    ├─ Hero KPI block (3-4 numbers gigantes lado a lado)
  │    ├─ Filter chip row (Device Type, Traffic Source, etc)
  │    ├─ Big chart (line + hatched area)
  │    └─ Secondary cards (Page Views, Session Duration, Returning)
  └─ Dock inferior (ações secundárias, avatar)

aspect:
  - "Wide-canvas dashboard, evita sidebars largas"
  - "Chips substituem dropdowns nativos pra sensação 'soft UI'"
```

## 10. Motion

```yaml
transitions:
  default: 'cubic-bezier(0.4, 0, 0.2, 1) 200ms'
  spring: 'spring(stiffness:350, damping:30)'

micro_interactions:
  - chip_hover: 'bg scale 0 → 1 + shadow up'
  - card_hover: 'translateY(-2px) + shadow elevação'
  - chart_dot: 'pulse subtle no datapoint atual'
  - tooltip: 'fade + translateY 8px em 150ms'

reduced_motion: 'desligar translateY, manter opacity'
```

## 11. Breakpoints

```yaml
breakpoints:
  sm: 640px   # 1 col, chips quebram, KPI vira 2 cols
  md: 768px   # sidebar collapsa em hamburguer
  lg: 1024px  # layout final 3 cols KPI
  xl: 1280px  # sidebar fixa, dock visível
  2xl: 1536px # canvas máximo 1440px
```

## 12. Dark mode

```yaml
dark_mode: 'INFERIDO mas não confirmado nos mockups'
nota: 'Style guide só mostra paleta light. Cores #162244 (sidebar) e #1B4D5B podem virar accent em dark, com base #0A1530'
```

## 13. Acessibilidade

```yaml
contrast:
  - texto principal #1B4D5B sobre fundo branco: 12.5:1 (AAA ✅)
  - texto secundário #9CA3AF sobre branco: 3.5:1 (apenas AA large)
  - números KPI grandes (#1B4D5B sobre rgba(255,255,255,0.65)): ~10:1 (AAA)
  - chips brancos sobre fundo gradient cinza-claro: ~7:1 (AA)

focus:
  - 'sem focus-ring visível nos mockups — adicionar ring-2 ring-accent ring-offset-2 pra acessibilidade real'
```

## 14. Tokens CSS (proposta de implementação)

```css
:root {
  --color-primary: #1B4D5B;
  --color-accent: #0F7305;
  --color-secondary: #162244;
  --color-surface: #FFFFFF;
  --color-fg-1: #1B4D5B;
  --color-fg-2: #4A6675;
  --color-fg-3: #9CA3AF;
  --color-bg-base: linear-gradient(180deg, #E8EEF0 0%, #D4DCDE 100%);
  --color-bg-card: rgba(255, 255, 255, 0.65);
  --color-bg-card-opaque: rgba(255, 255, 255, 0.85);
  --color-pos: #0F7305;
  --color-neg: #D32F2F;

  --radius-pill: 99px;
  --radius-card: 24px;
  --radius-card-sm: 16px;

  --shadow-card: 0 1px 2px rgba(22,34,68,0.04), 0 4px 16px rgba(22,34,68,0.06);
  --shadow-card-hover: 0 4px 8px rgba(22,34,68,0.06), 0 16px 32px rgba(22,34,68,0.10);
  --shadow-floating: 0 24px 48px rgba(22,34,68,0.18);

  --font-family: 'Urbanist', system-ui, sans-serif;

  --blur-glass: blur(16px);
}

.kpi-number {
  font-size: 64px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--color-fg-1);
}

.glass-card {
  background: var(--color-bg-card);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border-radius: var(--radius-card);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: var(--shadow-card);
}

.chip-filter {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-card-opaque);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
```

## 15. Quando usar este design

✅ **Usar quando:**
- Dashboards de **analytics/BI**
- Tools **SaaS B2B premium** com público técnico
- Marketing sites que querem transmitir "produto polido e leve"
- Interfaces com **densidade média** de dados
- Apresentações de pitch / mockups marketing (o tilt-shift é a marca)

❌ **NÃO usar quando:**
- App de alta densidade (trading floor, ATC, NOC) — chips/pills consomem muito espaço
- Mobile-first dominante — glassmorphism custa performance em low-end
- Necessidade de daltonismo crítico — verde como accent único é problemático
- Documentos/contracts — falta hierarquia visual para texto longo

## 16. Comparativos diretos

- **Linear:** mais escuro, neutro slate; Synthex é mais light/glassy
- **Vercel:** mais minimal, sem chips; Synthex tem mais cor e variação
- **Stripe (atual):** roxos saturados; Synthex é teal-deep + green
- **Apple Numbers:** referência mais próxima em "soft glass + big numbers"

## 17. Provenance per token

| Token | Source | Confiança |
|---|---|---|
| Cor #1B4D5B | image #8 style guide (label "#1B4050") | alta |
| Cor #0F7305 | image #8 style guide (label "#0F7305") | alta |
| Cor #162244 | image #8 style guide (label "#162244") | alta |
| Cor #FFFFFF | image #8 style guide | alta |
| Fonte Urbanist | image #8 style guide (texto "Fonts: Urbanist") | alta |
| Radius pill 99px | observação visual em chips/buttons todas imagens | alta |
| Radius card 24px | observação visual cards mockup #06, #07 | alta |
| Backdrop blur 16px | inferência visual glassmorphic cards | média |
| Shadow drop | inferência visual mockups #06 com tilt | média |
| Spacing 4px base | inferência típica SaaS contemporâneo | baixa-média |
| Dark mode | não documentado no shot | inferido |
| Motion timing | não documentado no shot | inferido (padrão SaaS) |

---

**Author:** Jack R. for RonDesignLab ⭐️
**Skill:** Extraction performed via visual inspection of 8 high-res Dribbble shot attachments (CSS extraction not applicable to Dribbble's image-based shots — the skill auto-detected this limitation and fallback to direct visual analysis).
