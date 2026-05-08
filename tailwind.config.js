/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-0': 'var(--bg-0)',
        'bg-1': 'var(--bg-1)',
        'bg-2': 'var(--bg-2)',
        'bg-3': 'var(--bg-3)',
        'bg-inset': 'var(--bg-inset)',

        'fg-1': 'var(--fg-1)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
        'fg-4': 'var(--fg-4)',

        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-glow': 'var(--accent-glow)',

        pos: 'var(--pos)',
        neg: 'var(--neg)',
        warn: 'var(--warn)',
        info: 'var(--info)',

        'grain-soja': 'var(--grain-soja)',
        'grain-milho': 'var(--grain-milho)',
        'grain-trigo': 'var(--grain-trigo)',
        'grain-usd': 'var(--grain-usd)',

        'border-1': 'var(--border-1)',
        'border-2': 'var(--border-2)',
      },
      borderColor: {
        'border-1': 'var(--border-1)',
        'border-2': 'var(--border-2)',
      },
      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        7: 'var(--space-7)',
        8: 'var(--space-8)',
        9: 'var(--space-9)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        glow: 'var(--shadow-glow)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        display: ['56px', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['40px', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '600' }],
        h2: ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5', letterSpacing: '0' }],
        small: ['12.5px', { lineHeight: '1.45', letterSpacing: '0.005em' }],
        micro: ['11px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
      },
    },
  },
  plugins: [],
}
