'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Copy,
  ExternalLink,
  CheckCircle2,
  Wheat,
  HelpCircle,
  Webhook,
} from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  GrainBadge,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export default function WebhooksPage() {
  const { status } = useSession()
  const router = useRouter()
  const { success } = useToast()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/tradingview` : ''
  const secret = process.env.NEXT_PUBLIC_TRADINGVIEW_WEBHOOK_SECRET || 'seu-secret-aqui'
  const bodyJson = JSON.stringify(
    {
      symbol: '{{ticker}}',
      close: '{{close}}',
      high: '{{high}}',
      low: '{{low}}',
      volume: '{{volume}}',
      time: '{{time}}',
    },
    null,
    2
  )

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    success('Copiado para a área de transferência')
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const Step = ({
    n,
    title,
    children,
  }: {
    n: string
    title: string
    children: React.ReactNode
  }) => (
    <div className="border-l-2 border-l-accent pl-5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="t-num text-accent text-small font-semibold">{n}</span>
        <h3 className="text-fg-1 font-semibold text-body">{title}</h3>
      </div>
      <div className="space-y-3 text-fg-2 text-small">{children}</div>
    </div>
  )

  const CopyField = ({
    label,
    value,
    fieldKey,
    monoBlock,
  }: {
    label: string
    value: string
    fieldKey: string
    monoBlock?: boolean
  }) => (
    <div className="space-y-1.5">
      <p className="eyebrow">{label}</p>
      {monoBlock ? (
        <div className="bg-bg-inset border border-border-1 rounded-md overflow-hidden">
          <pre className="text-fg-1 font-mono text-small p-3 overflow-x-auto whitespace-pre">
            {value}
          </pre>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            readOnly
            value={value}
            className="flex-1 h-11 px-4 rounded-md bg-bg-2 border border-border-1 text-fg-1 font-mono text-small outline-none"
          />
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        leftIcon={
          copiedKey === fieldKey ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-pos" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )
        }
        onClick={() => copyToClipboard(value, fieldKey)}
      >
        {copiedKey === fieldKey ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  )

  return (
    <AppShell>
      <PageHeader
        eyebrow="Integrações · TradingView"
        title="Configurar webhooks"
        subtitle="Receba cotações em tempo real via webhook do TradingView."
        search={false}
      />

      <Card className="mb-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-bg-2 border border-border-1 flex items-center justify-center shrink-0">
            <Webhook className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-1">
            <h2 className="text-h2 font-sans tracking-tight text-fg-1">
              Setup TradingView
            </h2>
            <p className="text-fg-2 text-body">
              Siga as etapas abaixo para integrar alertas de preço.
            </p>
          </div>
        </div>

        <Step n="1" title="Acesse sua conta TradingView">
          <p>
            Vá para{' '}
            <span className="text-fg-1 font-mono text-small bg-bg-2 border border-border-1 rounded-sm px-1.5 py-0.5">
              Alertas
            </span>{' '}
            no menu da direita.
          </p>
          <a
            href="https://www.tradingview.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent text-small hover:underline"
          >
            Abrir TradingView <ExternalLink className="h-3 w-3" />
          </a>
        </Step>

        <Step n="2" title="Crie 3 alertas">
          <p>Configure um alerta para cada commodity:</p>
          <div className="flex flex-wrap gap-2">
            <GrainBadge variant="soja" label="ZS · Soja" />
            <GrainBadge variant="milho" label="ZC · Milho" />
            <GrainBadge variant="trigo" label="ZW · Trigo" />
          </div>
          <p className="text-fg-3">
            Recomendação: alertas diários ao fechamento para receber 1 update por sessão.
          </p>
        </Step>

        <Step n="3" title="Configure o webhook">
          <p>Em cada alerta, na aba Notificações, cole os campos abaixo:</p>

          <div className="space-y-4 pt-2">
            <CopyField label="Webhook URL" value={webhookUrl} fieldKey="url" />
            <CopyField
              label="Header — Authorization"
              value={`Bearer ${secret}`}
              fieldKey="auth"
            />
            <CopyField label="Body (JSON)" value={bodyJson} fieldKey="body" monoBlock />
          </div>
        </Step>

        <Step n="4" title="Teste o webhook">
          <p>
            Em{' '}
            <span className="text-fg-1 font-mono text-small bg-bg-2 border border-border-1 rounded-sm px-1.5 py-0.5">
              Alertas → Seu alerta → Teste
            </span>
            , dispare uma chamada de teste. Você deve receber a notificação no endpoint{' '}
            <span className="text-fg-1 font-mono text-small bg-bg-2 border border-border-1 rounded-sm px-1.5 py-0.5">
              /api/webhooks/tradingview
            </span>
            .
          </p>
        </Step>

        <div className="border-l-2 border-l-pos pl-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-pos" />
            <h3 className="text-fg-1 font-semibold text-body">Pronto</h3>
          </div>
          <p className="text-fg-2 text-small">
            As cotações aparecerão em{' '}
            <a href="/cotacoes" className="text-accent hover:underline">
              /cotacoes
            </a>{' '}
            assim que o primeiro webhook for processado.
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-warn" />
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">Troubleshooting</h3>
        </div>
        <ul className="space-y-3 text-fg-2 text-small">
          <li className="flex gap-3">
            <Chip variant="warn" className="shrink-0">Webhook não dispara</Chip>
            <span>Verifique se a URL está correta e acessível publicamente.</span>
          </li>
          <li className="flex gap-3">
            <Chip variant="neg" className="shrink-0">Erro 401</Chip>
            <span>Confira se o Bearer token está no header Authorization.</span>
          </li>
          <li className="flex gap-3">
            <Chip variant="info" className="shrink-0">Sem cotações</Chip>
            <span>
              Verifique a tabela{' '}
              <span className="text-fg-1 font-mono">WebhookLog</span> para erros recentes.
            </span>
          </li>
          <li className="flex gap-3">
            <Chip variant="neutral" className="shrink-0">Documentação</Chip>
            <span>
              Leia{' '}
              <span className="text-fg-1 font-mono">TRADINGVIEW_SETUP.md</span> no repositório.
            </span>
          </li>
        </ul>
      </Card>
    </AppShell>
  )
}
