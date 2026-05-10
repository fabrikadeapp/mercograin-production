import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'BH Grain — Toda sua mesa de operações em um só lugar'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #051a0d 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: 80,
          fontFamily: 'system-ui, sans-serif',
          color: '#fafafa',
          position: 'relative',
        }}
      >
        {/* Glow verde-grão de fundo */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(10, 138, 58, 0.35) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#0a8a3a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            B
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: '#fafafa' }}>BH</span>
            <span style={{ fontSize: 36, fontWeight: 400, color: '#0a8a3a' }}>Grain</span>
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            marginTop: 80,
            color: '#0a8a3a',
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          Trading de grãos · Mesa de operações
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            marginTop: 24,
            color: '#fafafa',
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          Toda sua mesa de operações em um só lugar.
        </div>

        {/* Bottom row — cotações ao vivo */}
        <div
          style={{
            display: 'flex',
            gap: 48,
            marginTop: 'auto',
            paddingTop: 24,
            borderTop: '1px solid #1f1f1f',
          }}
        >
          {[
            { label: 'SOJA', value: 'R$ 127,70', color: '#0a8a3a' },
            { label: 'MILHO', value: 'R$ 65,18', color: '#d4a017' },
            { label: 'TRIGO', value: 'R$ 80,59', color: '#a06a3c' },
            { label: 'USD', value: 'R$ 4,90', color: '#5b9bd5' },
          ].map((q) => (
            <div key={q.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, color: '#737373', letterSpacing: 2 }}>{q.label}</span>
              <span style={{ fontSize: 32, fontWeight: 600, color: q.color, marginTop: 4 }}>
                {q.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
