'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  AtSign,
  Quote,
  Minus,
} from 'lucide-react'
import { TEMPLATE_VARIABLES, type TemplateVariable } from '@/lib/contratos/template-vars'

interface Props {
  initialContent?: any
  onChange?: (json: any) => void
  placeholder?: string
}

export function TemplateEditor({ initialContent, onChange, placeholder = 'Comece a digitar o template do contrato...' }: Props) {
  const [showVars, setShowVars] = React.useState(false)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent ?? '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
  })

  // Close variable menu when clicking outside
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setShowVars(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!editor) {
    return <div className="border border-border-1 rounded-lg p-6 text-fg-3 text-small">Carregando editor…</div>
  }

  function insertVariable(v: TemplateVariable) {
    editor!.chain().focus().insertContent(`{{${v.key}}}`).run()
    setShowVars(false)
  }

  const grouped = TEMPLATE_VARIABLES.reduce<Record<string, TemplateVariable[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {})

  const tbBtn = 'p-2 rounded-md text-fg-2 hover:text-fg-1 hover:bg-bg-3 transition-colors'
  const tbBtnActive = 'p-2 rounded-md text-accent bg-accent/10'

  return (
    <div className="border border-border-1 rounded-lg overflow-hidden bg-bg-2">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-2 border-b border-border-1 bg-bg-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? tbBtnActive : tbBtn}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? tbBtnActive : tbBtn}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-border-1 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? tbBtnActive : tbBtn}
          title="Título 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? tbBtnActive : tbBtn}
          title="Título 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? tbBtnActive : tbBtn}
          title="Título 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-border-1 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? tbBtnActive : tbBtn}
          title="Lista"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? tbBtnActive : tbBtn}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? tbBtnActive : tbBtn}
          title="Citação"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={tbBtn}
          title="Linha horizontal"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-border-1 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className={tbBtn}
          title="Tabela"
        >
          <TableIcon className="h-4 w-4" />
        </button>

        <span className="ml-auto" />

        <div ref={wrapRef} className="relative">
          <button
            type="button"
            onClick={() => setShowVars((v) => !v)}
            className="px-3 py-1.5 bg-accent text-accent-ink text-small font-medium rounded-md flex items-center gap-1.5 hover:opacity-90"
          >
            <AtSign className="h-3.5 w-3.5" />
            Inserir variável
          </button>
          {showVars && (
            <div className="absolute right-0 mt-1 w-96 max-h-[28rem] overflow-y-auto bg-bg-2 border border-border-2 rounded-md shadow-pop z-30">
              {Object.entries(grouped).map(([cat, vars]) => (
                <div key={cat}>
                  <div className="px-3 py-2 eyebrow border-b border-border-1 sticky top-0 bg-bg-1 z-10">
                    {cat}
                  </div>
                  {vars.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="w-full px-3 py-2 text-left hover:bg-bg-3 flex items-start justify-between gap-3 border-b border-border-1/50"
                    >
                      <div className="min-w-0">
                        <div className="text-fg-1 text-small">{v.label}</div>
                        <div className="text-fg-3 text-micro font-mono truncate">{`{{${v.key}}}`}</div>
                      </div>
                      <span className="text-fg-4 text-micro shrink-0 truncate max-w-[40%]">
                        {v.example}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="p-6 min-h-[420px] text-fg-1">
        <style jsx global>{`
          .tiptap-content {
            outline: none;
            min-height: 380px;
            color: var(--fg-1);
            font-size: 14px;
            line-height: 1.6;
          }
          .tiptap-content h1 {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--fg-1);
            margin: 1rem 0 0.5rem;
          }
          .tiptap-content h2 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--fg-1);
            margin: 0.85rem 0 0.4rem;
          }
          .tiptap-content h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--fg-1);
            margin: 0.7rem 0 0.3rem;
          }
          .tiptap-content p {
            color: var(--fg-1);
            margin: 0.5em 0;
          }
          .tiptap-content ul,
          .tiptap-content ol {
            padding-left: 1.5rem;
            margin: 0.5em 0;
          }
          .tiptap-content ul { list-style: disc; }
          .tiptap-content ol { list-style: decimal; }
          .tiptap-content li { margin: 0.2em 0; }
          .tiptap-content blockquote {
            border-left: 3px solid var(--border-2);
            padding-left: 0.85rem;
            color: var(--fg-2);
            margin: 0.6rem 0;
            font-style: italic;
          }
          .tiptap-content hr {
            border: none;
            border-top: 1px solid var(--border-1);
            margin: 1rem 0;
          }
          .tiptap-content p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: var(--fg-4);
            pointer-events: none;
            float: left;
            height: 0;
          }
          .tiptap-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.6rem 0;
          }
          .tiptap-content td,
          .tiptap-content th {
            border: 1px solid var(--border-1);
            padding: 6px 10px;
            min-width: 80px;
            vertical-align: top;
          }
          .tiptap-content th {
            background: var(--bg-3);
            font-weight: 600;
          }
          .tiptap-content code {
            background: var(--bg-3);
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 0.9em;
          }
          /* Highlight {{var}} placeholders visually */
          .tiptap-content {
            --var-bg: rgba(99, 102, 241, 0.12);
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
