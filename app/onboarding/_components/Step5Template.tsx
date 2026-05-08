'use client'
import { useState } from 'react'
import { FileText, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/phb'
import { cn } from '@/lib/utils/cn'

interface Props {
  workspaceId: string
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

interface TemplateOption {
  id: string
  nome: string
  tipo: 'compra' | 'venda' | 'outros'
  descricao: string
  preview: string
  contentJson: any
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'compra-soja-cbot',
    nome: 'Compra de soja CBOT',
    tipo: 'compra',
    descricao: 'Modelo padrão para compra de soja com referência CBOT + dólar.',
    preview:
      'Contrato de compra de {{quantidade}} sacas de soja a {{preco}}/sc. Cliente: {{cliente.nome}} (CNPJ {{cliente.cnpj}}). Vencimento CBOT {{vencimento}}.',
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Contrato de Compra de Soja - Referência CBOT' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Pelo presente instrumento, {{empresa.razaoSocial}} (CNPJ {{empresa.cnpj}}) compra de {{cliente.nome}} (CNPJ {{cliente.cnpj}}) a quantidade de {{quantidade}} sacas de soja, ao preço unitário de R$ {{preco}}/sc, indexado ao contrato CBOT vencimento {{vencimento}} + dólar PTAX.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'venda-vista',
    nome: 'Venda à vista',
    tipo: 'venda',
    descricao: 'Modelo simples para venda à vista com pagamento imediato.',
    preview:
      'Venda à vista de {{quantidade}} sacas de {{grao}} para {{cliente.nome}} pelo valor total de R$ {{valorTotal}}.',
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Contrato de Venda à Vista' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '{{empresa.razaoSocial}} vende para {{cliente.nome}} (CNPJ {{cliente.cnpj}}) a quantidade de {{quantidade}} sacas de {{grao}}, pelo valor total de R$ {{valorTotal}}, com pagamento à vista no ato da entrega.',
            },
          ],
        },
      ],
    },
  },
]

const VARIAVEIS_PADRAO = [
  'empresa.razaoSocial',
  'empresa.cnpj',
  'cliente.nome',
  'cliente.cnpj',
  'contrato.numero',
  'quantidade',
  'preco',
  'grao',
  'vencimento',
  'valorTotal',
]

export function Step5Template({ onNext, onSkip, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])

  async function handleUse(t: TemplateOption) {
    setSaving(true)
    setError(null)
    setSelectedId(t.id)
    try {
      const res = await fetch('/api/contratos/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: t.nome,
          tipo: t.tipo,
          descricao: t.descricao,
          contentJson: t.contentJson,
          variaveis: VARIAVEIS_PADRAO,
          isDefault: savedIds.length === 0,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Erro ao salvar template')
      }
      setSavedIds((s) => [...s, t.id])
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-fg-3 mb-2">PASSO 5 · TEMPLATES</div>
        <h1 className="text-h2 text-fg-1 mb-2">Modelos de contrato</h1>
        <p className="text-fg-3">
          Comece com modelos prontos. Você pode editar tudo depois com nosso
          editor visual em Contratos &gt; Templates.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-neg/10 border border-neg/30 text-neg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => {
          const used = savedIds.includes(t.id)
          return (
            <div
              key={t.id}
              className={cn(
                'border rounded-card bg-bg-1 p-5 flex flex-col',
                used ? 'border-pos' : 'border-border-1'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-7 h-7 text-accent" />
                {used && (
                  <span className="inline-flex items-center gap-1 text-xs text-pos font-medium">
                    <Check className="w-3.5 h-3.5" />
                    Adicionado
                  </span>
                )}
              </div>
              <div className="font-semibold text-fg-1 mb-1">{t.nome}</div>
              <div className="text-fg-3 text-sm mb-3">{t.descricao}</div>
              <div className="text-fg-4 text-xs italic mb-4 line-clamp-3 bg-bg-0 p-2 rounded-md border border-border-1">
                {t.preview}
              </div>
              <div className="mt-auto">
                <Button
                  type="button"
                  variant={used ? 'secondary' : 'primary'}
                  fullWidth
                  loading={saving && selectedId === t.id}
                  disabled={used}
                  onClick={() => handleUse(t)}
                >
                  {used ? 'Adicionado' : 'Usar template'}
                </Button>
              </div>
            </div>
          )
        })}

        {/* Em branco */}
        <div className="border border-dashed border-border-1 rounded-card bg-bg-1 p-5 flex flex-col">
          <Plus className="w-7 h-7 text-fg-3 mb-3" />
          <div className="font-semibold text-fg-1 mb-1">Criar do zero</div>
          <div className="text-fg-3 text-sm mb-3">
            Use o editor visual depois para montar seu próprio modelo com
            placeholders dinâmicos.
          </div>
          <div className="mt-auto">
            <Button type="button" variant="ghost" fullWidth onClick={onSkip}>
              Configurar depois
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onSkip}>
            Pular - configurar depois
          </Button>
          <Button type="button" onClick={onNext} size="lg">
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}
