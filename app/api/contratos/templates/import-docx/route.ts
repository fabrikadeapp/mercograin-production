/**
 * POST /api/contratos/templates/import-docx
 *
 * Recebe upload .docx (multipart), converte para HTML via mammoth e devolve
 * o HTML pronto para ser carregado no editor TipTap (que internamente
 * converte HTML → ProseMirror JSON automaticamente).
 *
 * Por que retornar HTML e não JSON?
 *   TipTap aceita `editor.commands.setContent(html)` direto. Manter a
 *   conversão no client elimina dependência server (@tiptap/html) e
 *   garante usar exatamente as mesmas extensions do editor visual.
 *
 * Limite: 5MB. Mammoth pode demorar em docs muito grandes; se passar,
 * sugira split.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { uploadImage, getExtensionForMime } from '@/lib/storage/local'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

// Estilos do Word mapeados para tags semânticas que o TipTap entende
const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
]

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Lê o multipart
    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(
        { error: 'Envio inválido. Esperado multipart/form-data com campo "file"' },
        { status: 400 }
      )
    }

    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo excede ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    const name = (file as File).name ?? 'documento.docx'
    if (!name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Apenas arquivos .docx são aceitos. Salve o documento como .docx no Word.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Lazy import — mammoth puxa dependências pesadas que só queremos na rota.
    const mammoth = (await import('mammoth')).default ?? (await import('mammoth'))

    let imagensSubidas = 0
    let imagensFalhadas = 0

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: STYLE_MAP,
        convertImage: mammoth.images.imgElement(async (image) => {
          try {
            const mime = (image.contentType ?? 'image/png').toLowerCase()
            const ext = getExtensionForMime(mime)
            if (ext === 'bin') {
              imagensFalhadas++
              return { src: '' }
            }
            const imgBuf = await image.read()
            if (!(imgBuf instanceof Buffer)) {
              imagensFalhadas++
              return { src: '' }
            }
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
            const upload = await uploadImage({
              buffer: imgBuf,
              mimeType: mime,
              pathPrefix: `contratos-templates/${scope.workspaceId}`,
              fileName,
            })
            imagensSubidas++
            return { src: upload.publicUrl, alt: 'imagem importada' }
          } catch (err) {
            console.warn('[import-docx] falha em imagem:', err)
            imagensFalhadas++
            return { src: '' }
          }
        }),
      }
    )

    // Limpa <img src=""> que mammoth deixou para placeholders falhados
    const html = result.value.replace(/<img[^>]*src=""[^>]*>/g, '')

    return NextResponse.json({
      html,
      sugestaoNome: name.replace(/\.docx$/i, ''),
      tamanhoBytes: file.size,
      imagens: { subidas: imagensSubidas, falhadas: imagensFalhadas },
      messages: result.messages
        .filter((m) => m.type === 'warning' || m.type === 'error')
        .slice(0, 20)
        .map((m) => ({ type: m.type, message: m.message })),
    })
  } catch (error) {
    console.error('Import DOCX error:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar arquivo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
