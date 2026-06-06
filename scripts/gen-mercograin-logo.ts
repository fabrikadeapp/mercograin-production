/**
 * Gera um logo PNG simples para a Mercograin e grava no storage local
 * + atualiza DadosEmpresa.logoUrl.
 *
 * Uso: tsx scripts/gen-mercograin-logo.ts
 *
 * O PNG gerado é deliberadamente simples (320x80, fundo verde, sigla "M") —
 * apenas um placeholder funcional. O cliente real deve subir o próprio logo
 * pela rota /configuracoes/marca.
 */
import { PNG } from 'pngjs'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const WIDTH = 320
const HEIGHT = 80

const BG = { r: 10, g: 95, b: 42 } // verde escuro
const ACCENT = { r: 132, g: 204, b: 22 } // lima
const WHITE = { r: 255, g: 255, b: 255 }

// "M" gigante desenhado por pixels (uma matriz 5x7 escalada)
const LETTER_M = [
  '#...#',
  '##.##',
  '#.#.#',
  '#.#.#',
  '#...#',
  '#...#',
  '#...#',
]

function setPixel(png: PNG, x: number, y: number, rgb: { r: number; g: number; b: number }) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
  const idx = (WIDTH * y + x) << 2
  png.data[idx] = rgb.r
  png.data[idx + 1] = rgb.g
  png.data[idx + 2] = rgb.b
  png.data[idx + 3] = 255
}

function drawRect(png: PNG, x: number, y: number, w: number, h: number, rgb: typeof BG) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      setPixel(png, x + dx, y + dy, rgb)
    }
  }
}

async function main() {
  const png = new PNG({ width: WIDTH, height: HEIGHT, colorType: 6 })
  // Fundo verde
  drawRect(png, 0, 0, WIDTH, HEIGHT, BG)

  // Quadrado-marca à esquerda (lima)
  drawRect(png, 18, 16, 48, 48, ACCENT)

  // Letra M centralizada no quadrado (5x7 * scale 5 = 25x35), começa em (18+11, 16+6)
  const SCALE = 5
  const startX = 18 + 11
  const startY = 16 + 6
  for (let row = 0; row < LETTER_M.length; row++) {
    for (let col = 0; col < LETTER_M[row].length; col++) {
      if (LETTER_M[row][col] === '#') {
        drawRect(png, startX + col * SCALE, startY + row * SCALE, SCALE, SCALE, BG)
      }
    }
  }

  // Barra de "wordmark" — desenha 5 listras horizontais simulando o texto
  // (sem fonte de verdade, isso é placeholder visual)
  const textY = 30
  for (let i = 0; i < 5; i++) {
    drawRect(png, 90, textY + i * 8, 200 - i * 12, 3, WHITE)
  }

  const out = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    png
      .pack()
      .on('data', (c: Buffer) => chunks.push(c))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject)
  })

  // Salva em /public/logos/mercograin.png (para servir estaticamente em dev)
  const publicPath = path.join(process.cwd(), 'public/logos/mercograin.png')
  await mkdir(path.dirname(publicPath), { recursive: true })
  await writeFile(publicPath, out)
  console.log(`Gerado: ${publicPath} (${out.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
