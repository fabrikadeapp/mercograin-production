'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface Contrato {
  id: string
  numero: string
}
interface Fornecedor {
  id: string
  razaoSocial?: string | null
  nomeFantasia?: string | null
}

export default function NovoRoyaltyPage() {
  const router = useRouter()
  const toast = useToast()

  const [contratos, setContratos] = React.useState<Contrato[]>([])
  const [detentores, setDetentores] = React.useState<Fornecedor[]>([])

  const [contratoId, setContratoId] = React.useState('')
  const [detentorId, setDetentorId] = React.useState('')
  const [cultivar, setCultivar] = React.useState('')
  const [qtdSc, setQtdSc] = React.useState('')
  const [valorPorSc, setValorPorSc] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/contratos').then((r) => r.json()).catch(() => []),
      fetch('/api/fornecedores').then((r) => r.json()).catch(() => []),
    ]).then(([c, f]) => {
      setContratos(Array.isArray(c) ? c : c?.data ?? [])
      setDetentores(Array.isArray(f) ? f : f?.data ?? [])
    })
  }, [])

  function parseN(v: string): number {
    return Number(v.replace(/\./g, '').replace(',', '.'))
  }

  const total = (() => {
    const q = parseN(qtdSc)
    const p = parseN(valorPorSc)
    return Number.isFinite(q) && Number.isFinite(p) ? q * p : 0
  })()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contratoId) {
      toast.error('Selecione o contrato')
      return
    }
    if (!detentorId) {
      toast.error('Selecione o detentor da cultivar (fornecedor)')
      return
    }
    const q = parseN(qtdSc)
    const v = parseN(valorPorSc)
    if (!Number.isFinite(q) || q <= 0) {
      toast.error('Informe a quantidade em sacas')
      return
    }
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Informe o valor por saca')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/royalties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          detentorId,
          cultivar: cultivar.trim(),
          qtdSc: q,
          valorPorSc: v,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      toast.success('Royalty registrado')
      router.push('/financeiro/royalties')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Financeiro · Royalties"
        title="Novo royalty"
        subtitle="Apuração manual de royalty devido por uso de cultivar protegida."
        search={false}
        showBell={false}
        actions={
          <Link href="/financeiro/royalties">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-small text-fg-2 mb-1.5">Contrato *</label>
            <select
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              required
            >
              <option value="" disabled>— Selecione —</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>{c.numero}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Detentor da cultivar (fornecedor) *
            </label>
            <select
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              value={detentorId}
              onChange={(e) => setDetentorId(e.target.value)}
              required
            >
              <option value="" disabled>— Selecione —</option>
              {detentores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.razaoSocial || d.nomeFantasia || d.id}
                </option>
              ))}
            </select>
            {detentores.length === 0 && (
              <p className="text-micro mt-1" style={{ color: 'var(--warn)' }}>
                Nenhum fornecedor cadastrado.{' '}
                <Link href="/fornecedores/novo" className="underline">
                  Cadastrar agora →
                </Link>
              </p>
            )}
          </div>

          <Input
            label="Cultivar *"
            placeholder="Ex.: BRS 511, Pioneer P0573"
            value={cultivar}
            onChange={(e) => setCultivar(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Quantidade (sacas) *"
              placeholder="1000"
              value={qtdSc}
              onChange={(e) => setQtdSc(e.target.value)}
              required
            />
            <Input
              label="Valor por saca (R$) *"
              placeholder="2,50"
              value={valorPorSc}
              onChange={(e) => setValorPorSc(e.target.value)}
              required
            />
          </div>

          {total > 0 && (
            <Card className="p-4" style={{ background: 'var(--bg-2)' }}>
              <p className="eyebrow text-fg-3 mb-1">VALOR TOTAL APURADO</p>
              <p className="t-num-lg text-fg-1">
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </Card>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Registrar royalty'}
            </Button>
            <Link href="/financeiro/royalties">
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
