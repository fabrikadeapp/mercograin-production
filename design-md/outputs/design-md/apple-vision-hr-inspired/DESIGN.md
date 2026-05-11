---
name: VisionGlass
version: 0.1.0
description: Dark glassmorphism design system inspired by visionOS-style spatial UI for dashboards. Translucent cards over warm ambient backdrop, oversized display typography, iOS system accent colors, generous corner radii.
archetype: apple-glass
mode: dark
source: user-provided dashboard reference (Figma community piece, authorized)
status: draft
---

# VisionGlass — Design System

A dark glassmorphism system for data-dense dashboards. The aesthetic borrows the spatial language of visionOS: depth via translucency and blur, not via heavy shadows; oversized type that establishes hierarchy at a glance; pill-shaped controls; a floating dock for primary navigation.

## Visual principles

1. **Depth comes from blur, not shadow.** Every primary surface is a `backdrop-filter: blur()` layer over an ambient backdrop. Shadows only reinforce — they never carry the depth alone.
2. **Type does the heavy lifting.** The welcome line uses display-xl (64px, weight 700) so identity is felt before any data is read. Numeric values use a metric size with tabular figures to stay grid-aligned.
3. **Color is restraint + saturation.** 95% neutral grays with translucency; saturated accents reserved for state (`#0A84FF` primary, `#FF453A` destructive, `#30D158` positive).
4. **Radii are generous and pill-first.** Cards at 20px, buttons at 12px, CTAs and chips as full pills. Sharp corners only on data tables.
5. **Surfaces float, never lock.** The dock floats with margin from the bottom; cards never bleed to viewport edges; everything respects an outer scrim.

## Color

```yaml
background:
  surface:        '#0E0F12'         # base canvas behind glass
  scrim:          'rgba(14,15,18,0.55)'  # overlay over photo backdrops
  ambient:        'linear-gradient(135deg, #2A2620 0%, #1A1814 100%)'  # warm fallback

glass:
  card:           'rgba(28,28,32,0.62)'   # default card fill
  cardHover:      'rgba(38,38,44,0.72)'
  cardBorder:     'rgba(255,255,255,0.08)'
  cardBorderStrong: 'rgba(255,255,255,0.14)'  # focused / selected
  dock:           'rgba(20,20,24,0.78)'
  dockBorder:     'rgba(255,255,255,0.10)'
  pillTrack:      'rgba(255,255,255,0.06)'   # progress bar background
  pillThumb:      'rgba(255,255,255,0.18)'

foreground:
  primary:        '#F5F5F7'                    # body text on dark
  secondary:      'rgba(235,235,245,0.72)'    # captions, labels
  tertiary:       'rgba(235,235,245,0.50)'    # subdued labels
  quaternary:     'rgba(235,235,245,0.30)'    # placeholders, dividers
  onAccent:       '#FFFFFF'

accent:
  primary:        '#0A84FF'              # CTA blue
  primaryHover:   '#3B9DFF'
  primaryMuted:   'rgba(10,132,255,0.16)'
  destructive:    '#FF453A'              # clock-out, errors, declines
  destructiveMuted: 'rgba(255,69,58,0.14)'
  success:        '#30D158'              # positive delta, approved
  successMuted:   'rgba(48,209,88,0.16)'
  warning:        '#FF9F0A'
  info:           '#64D2FF'

data:
  positive:       '#30D158'   # upward deltas
  negative:       '#FF453A'   # downward deltas
  neutral:        'rgba(235,235,245,0.50)'
```

**Usage rules**

- Default text on glass is `foreground.primary` (`#F5F5F7`). Drop to `secondary` for labels above values, `tertiary` for muted metadata.
- Accent blue is **single-purpose per view**: the one primary CTA (e.g. "Out for Lunch"). Multiple primaries in one view dilute the system.
- Destructive red flags actions that revoke state (Clock Out, Decline, Delete) and downward data deltas. Never use it for decorative emphasis.
- Never use pure white on pure black. The slight off-white (`#F5F5F7`) reduces contrast fatigue.

## Typography

Font: **Inter** (variable, weights 400–900). Self-host via `next/font/google` for performance and privacy.

```yaml
fontFamily:
  display: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
  text:    "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
  mono:    "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"

scale:
  displayXl: { size: 64px, lineHeight: 1.04, weight: 700, tracking: -0.025em }
  displayLg: { size: 48px, lineHeight: 1.08, weight: 700, tracking: -0.02em }
  h1:        { size: 32px, lineHeight: 1.15, weight: 700, tracking: -0.015em }
  h2:        { size: 24px, lineHeight: 1.20, weight: 600, tracking: -0.01em }
  h3:        { size: 20px, lineHeight: 1.30, weight: 600, tracking: -0.005em }
  bodyLg:    { size: 17px, lineHeight: 1.45, weight: 400 }
  body:      { size: 15px, lineHeight: 1.47, weight: 400 }
  bodySm:    { size: 13px, lineHeight: 1.46, weight: 400 }
  label:     { size: 13px, lineHeight: 1.30, weight: 500 }
  caption:   { size: 11px, lineHeight: 1.36, weight: 500, tracking: 0.01em }
  metric:    { size: 28px, lineHeight: 1.10, weight: 600, tracking: -0.02em, feature: "'tnum'" }
```

**Usage rules**

- Greeting line (`Welcome Back, Ibrahim Memon`) uses `displayXl` for the name only; the prefix stays at `bodyLg, secondary`.
- All numeric values (currency, counts, percentages) use the `metric` style with `font-feature-settings: 'tnum'` so digits stay in fixed columns when values change.
- Card titles are `h3 / weight 600`. Avoid bumping to `h2` inside cards — keeps the dashboard hierarchy clean.
- Caption (11px, weight 500) is the smallest legal size. Anything below trades legibility for density.

## Spacing & layout

Base unit `4px`. Scale follows the `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80` ramp.

- **Card internal padding:** `20px` default, `24px` for the hero card (the welcome / mark-attendance card).
- **Grid gap between cards:** `12px` on dense rows, `16px` on the main grid.
- **Section margin:** `24px` between rows of cards.
- **Outer scrim margin:** `20px` from viewport edges, `24px` bottom-safe for the dock.

The dashboard uses a 12-column grid; cards span 4 / 4 / 4 on the hero row, then 2 / 2 / 4 / 4 on the secondary row.

## Radius

```yaml
sm:       8px    # small chips, inline tags
md:       12px   # buttons, inputs, secondary actions
lg:       16px   # nested surfaces inside cards
xl:       20px   # cards (DEFAULT)
2xl:      24px   # hero card / modals
pill:     9999px # CTAs, segment toggles, badges
dock:     32px   # floating dock
```

The pill is the system's verb-form: anything that says "do X" (Out for Lunch, Approve, Fill Form) is a pill or a 12px-radius rounded rect. Anything that says "this is X" (cards, sections) is a 20px rounded rect.

## Shadow & elevation

Glass surfaces use a **dual treatment**: a thin inset highlight at the top + a soft dark drop. No mid-tone shadows; no harsh borders.

```yaml
card:         '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.32)'
cardElevated: '0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 40px rgba(0,0,0,0.42)'  # on hover
dock:         '0 12px 36px rgba(0,0,0,0.48), 0 1px 0 rgba(255,255,255,0.06) inset'
focus:        '0 0 0 3px rgba(10,132,255,0.40)'   # keyboard focus ring
glow:         '0 0 24px rgba(10,132,255,0.32)'    # for active state on dock items
```

`backdrop-filter: blur(32px)` on cards, `blur(40px)` on the dock. Provide a `@supports not` fallback that opaqueifies the surface to `rgba(28,28,32,0.92)` so non-Webkit browsers still render legibly.

## Motion

```yaml
duration: { instant: 80ms, fast: 160ms, base: 240ms, slow: 400ms, slower: 600ms }
easing:
  standard:   'cubic-bezier(0.4, 0, 0.2, 1)'
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)'    # entering elements
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)'    # exiting elements
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)'   # toggles, segment switches
```

- **Hover on cards:** `base` duration, `standard` easing — translateY(-2px) + `cardElevated` shadow.
- **Segment toggles** (e.g. Today / This Month / Date): `fast` + `spring` for the indicator slide.
- **Page transitions:** `slow` + `decelerate`, fade-in only — no slide.

Respect `prefers-reduced-motion: reduce` → cap durations at `fast` and remove the translateY.

## Components

### Card

The atomic unit of the dashboard.

```
Surface:   glass.card
Border:    1px solid glass.cardBorder
Radius:    radius.xl (20px)
Padding:   spacing.card.padding (20px)
Backdrop:  blur(32px)
Shadow:    shadow.card
```

Anatomy: header row (title `h3` + optional action icon top-right) → body content → optional footer chip row. Always reserve 1 line for the header even if empty — keeps card heights aligned.

### Pill CTA (primary)

```
Background: accent.primary
Foreground: foreground.onAccent
Padding:    12px 20px
Radius:     pill
Font:       body, weight 600
```

Secondary variant: `glass.card` background, no border, same dimensions. Destructive variant: `accent.destructive` with white text + an icon to the left.

### Segment toggle

A pill-shaped track holding 2–4 options. Active option has `accent.primary` background; inactive options have `foreground.secondary` text and no background. The indicator slides on change (`fast + spring`).

### Progress pill

Used for leave summaries ("15/15"). A pill-shaped track (`glass.pillTrack`) with an inner filled portion (`accent.primaryMuted` or `accent.successMuted` depending on completion). The numeric label sits inside, left-aligned, with the small leading icon.

### Avatar

Circular, with a 1px `glass.cardBorder` ring. Sizes 24 / 32 / 40 / 56. Always render an initials fallback over `accent.primaryMuted` if the image fails.

### Dock

A floating, full-width-bounded pill anchored 24px from the bottom of the viewport. Holds 4–6 icon+label pairs. Active item gets the `glow` shadow + `accent.primary` icon color. Background `glass.dock`, blur 40px.

### Add Widget tile

A dashed-outline placeholder that matches card dimensions but uses `border: 2px dashed glass.cardBorderStrong` and shows a centered `+` icon (`xl`) + caption "Add widget". Click opens the widget gallery.

## Accessibility

- Contrast: all foreground/background pairs above meet WCAG AA at the type sizes used. `foreground.tertiary` on `glass.card` is the lowest at 4.6:1 — do not use it for body text, only for metadata.
- Focus rings: `shadow.focus` on every interactive element. Never remove the ring even when adding a hover state.
- Hit targets: minimum 44×44px on touch surfaces (mobile dashboard). Pills shorter than 44px gain transparent padding to compensate.
- Reduced motion: as noted in Motion.
- Reduced transparency: when `prefers-reduced-transparency: reduce` is set, glass surfaces drop to opaque `#1C1C20` and lose blur — keeps the visual hierarchy without the GPU cost.

## Implementation notes

- **Glass fallback:** wrap `backdrop-filter` in `@supports (backdrop-filter: blur(1px))` and provide opaque fallbacks. Firefox without `gfx.webrender.all` and older Edge degrade gracefully.
- **Tabular numbers:** apply `font-feature-settings: 'tnum' 1, 'cv11' 1` on all metric values to align digits and use the slashed-zero variant.
- **Performance:** blur is expensive on Windows. Limit to 6–8 simultaneously blurred surfaces. Pre-rasterize where possible.
- **Photo backdrops:** when the surface uses a photo (as in the reference image), always place the `background.scrim` layer between the photo and the glass cards. Without it, glass contrast collapses on light photo regions.
- **Tokens consumption:** import from `tokens.json` via your build tool (Tailwind plugin / CSS-in-JS theme / CSS custom properties). Do not hardcode values in components.
