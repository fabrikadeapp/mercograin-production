/**
 * Geração on-the-fly de ícones PWA.
 *
 * Evita commitar PNGs no repo: usa ImageResponse do next/og (edge runtime).
 * Cacheável agressivamente já que o conteúdo só muda com a logo.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const ALLOWED = new Set([72, 96, 128, 144, 152, 192, 384, 512])

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } }
) {
  const n = parseInt(params.size, 10)
  const size = ALLOWED.has(n) ? n : 192

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a8a3a 0%, #064a20 100%)',
          color: 'white',
          fontWeight: 800,
          fontSize: size * 0.42,
          letterSpacing: '-0.05em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        BH
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  )
}
