'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface Armazem {
  id: string
  nome: string
}
interface Safra {
  id: string
  nome: string
  cultura?: string
}

export default function NovoLotePage() {
  const router = useRouter()
  const toast = useToast()

  const [armazens, setArmazens] = React.useState<Armazem[]>([])
  const [safras, setSafras] = React.useState<Safra[]>([])

  const [numero, setNumero] = React.useState('')
  const [cultura, setCultura] = React.useState<'soja' | 'milho' | 'trigo'>('soja')
  const [safraId, setSafraId] = React.useState('')
  const [armazemId, setArmazemId] = React.useState('')
  const [qtdInicialSc, setQtdInicialSc] = React.useState('')
  const [umidade, setUmidade] = React.useState('')
  const [impureza, setImpureza] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/armazens').then((r) => r.json()).catch(() => []),
      fetch('/api/safras').then((r) => r.json()).catch(() => []),
    ]).then(([a, s]) => {
      const arrA = Array.isArray(a) ? a : a?.data ?? []
      const arrS = Array.isArray(s) ? s : s?.data ?? []
      setArmazens(arrA)
      setSafras(arrS)
      if (arrA.length > 0) setArmazemId(arrA[0].id)
    })
  }, [])

  function parseN(v: string): number {
    return Number(v.replace(/\./g, '').replace(',', '.'))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!armazemId) {
      toast.error('Selecione um armazém (cadastre um em Logística > Armazéns)')
      return
    }
    const qtd = parseN(qtdInicialSc)
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error('Informe a quantidade em sacas (maior que zero)')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: numero.trim() || undefined,
          cultura,
          safraId: safraId || null,
          armazemId,
          qtdInicialSc: qtd,
          umidadeMedia: umidade ? parseN(umidade) : null,
          impurezaMedia: impureza ? parseN(impureza) : null,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      toast.success(`Lote ${json.numero} criado`)
      router.push('/operacao/estoque')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operação · Estoque"
        title="Novo lote / Entrada manual"
        subtitle="Para entradas via romaneio, use a balança. Use este form para ajuste de inventário ou abertura manual."
        search={false}
        showBell={false}
        actions={
          <Link href="/operacao/estoque">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5">
          <Input
            label="Número do lote (opcional — gerado automaticamente se vazio)"
            placeholder="LOTE-000001"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-small text-fg-2 mb-1.5">Cultura *</label>
              <select
                className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                value={cultura}
                onChange={(e) => setCultura(e.target.value as any)}
              >
                <option value="soja">Soja</option>
                <option value="milho">Milho</option>
                <option value="trigo">Trigo</option>
              </select>
            </div>
            <div>
              <label className="block text-small text-fg-2 mb-1.5">Safra (opcional)</label>
              <select
                className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                value={safraId}
                onChange={(e) => setSafraId(e.target.value)}
              >
                <option value="">— Sem safra —</option>
                {safras.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.cultura ? ` · ${s.cultura}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-small text-fg-2 mb-1.5">Armazém *</label>
            <select
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              value={armazemId}
              onChange={(e) => setArmazemId(e.target.value)}
              required
            >
              <option value="" disabled>— Selecione —</option>
              {armazens.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
            {armazens.length === 0 && (
              <p className="text-micro mt-1" style={{ color: 'var(--warn)' }}>
                Nenhum armazém cadastrado.{' '}
                <Link href="/logistica/armazens/novo" className="underline">
                  Cadastrar agora →
                </Link>
              </p>
            )}
          </div>

          <Input
            label="Quantidade inicial (sacas) *"
            placeholder="1000"
            value={qtdInicialSc}
            onChange={(e) => setQtdInicialSc(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Umidade média (%) — opcional"
              placeholder="13,5"
              value={umidade}
              onChange={(e) => setUmidade(e.target.value)}
            />
            <Input
              label="Impureza média (%) — opcional"
              placeholder="1,2"
              value={impureza}
              onChange={(e) => setImpureza(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Criando…' : 'Criar lote'}
            </Button>
            <Link href="/operacao/estoque">
              <Button variant="ghost" type="button">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
