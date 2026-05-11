'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

type Tipo = 'darf' | 'gnre' | 'gare'

const CODIGOS_DARF = [
  { value: '5952', label: '5952 — IRPJ (Lucro Real)' },
  { value: '2089', label: '2089 — IRPJ (Lucro Presumido)' },
  { value: '2362', label: '2362 — IRPJ (Lucro Real Estimativa)' },
  { value: '5993', label: '5993 — IRRF Trabalho Assalariado' },
  { value: '6912', label: '6912 — IRRF Pessoa Jurídica' },
  { value: '0561', label: '0561 — IRRF Aluguéis e Royalties PJ' },
  { value: '5856', label: '5856 — Cofins Não-Cumulativo' },
  { value: '2172', label: '2172 — Cofins Mercado Interno' },
  { value: '6912', label: '6912 — PIS Não-Cumulativo' },
  { value: '8109', label: '8109 — PIS Mercado Interno' },
]

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function NovaGuiaPage() {
  const router = useRouter()
  const toast = useToast()

  const [tipo, setTipo] = React.useState<Tipo>('darf')
  const [codigoReceita, setCodigoReceita] = React.useState('5952')
  const [contribuinteDoc, setContribuinteDoc] = React.useState('')
  const [contribuinteNome, setContribuinteNome] = React.useState('')
  const [periodoApuracao, setPeriodoApuracao] = React.useState(() => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [valorPrincipal, setValorPrincipal] = React.useState('')
  const [multa, setMulta] = React.useState('')
  const [juros, setJuros] = React.useState('')
  const [vencimento, setVencimento] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().slice(0, 10)
  })
  const [uf, setUf] = React.useState('SP')
  const [ie, setIe] = React.useState('')
  const [observacoes, setObservacoes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  function parseN(v: string): number {
    return Number(v.replace(/\./g, '').replace(',', '.'))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const vp = parseN(valorPrincipal)
    if (!Number.isFinite(vp) || vp <= 0) {
      toast.error('Informe o valor principal')
      return
    }
    if (!contribuinteDoc.trim() || !contribuinteNome.trim()) {
      toast.error('Informe contribuinte (CPF/CNPJ e nome)')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/fiscal/guias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          codigoReceita,
          contribuinteDoc: contribuinteDoc.trim(),
          contribuinteNome: contribuinteNome.trim(),
          periodoApuracao: periodoApuracao.trim(),
          valorPrincipal: vp,
          multa: multa ? parseN(multa) : 0,
          juros: juros ? parseN(juros) : 0,
          vencimento: new Date(vencimento).toISOString(),
          uf: tipo !== 'darf' ? uf : undefined,
          ie: tipo === 'gare' && ie ? ie : undefined,
          observacoes: observacoes.trim() || undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      toast.success(`Guia ${json.numero} criada`)
      router.push('/fiscal/guias')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Guias"
        title="Nova guia de arrecadação"
        subtitle="DARF (federal), GNRE (ICMS interestadual) ou GARE (SP)."
        search={false}
        showBell={false}
        actions={
          <Link href="/fiscal/guias">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-3xl p-6">
        <form onSubmit={submit} className="space-y-5">
          {/* Tipo selector — pills */}
          <div>
            <label className="block text-small text-fg-2 mb-2">Tipo de guia *</label>
            <div className="flex gap-2">
              {(['darf', 'gnre', 'gare'] as Tipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className="px-4 py-2 rounded-pill text-small font-medium transition"
                  style={
                    tipo === t
                      ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                      : { background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--border-1)' }
                  }
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-micro text-fg-3 mt-1">
              {tipo === 'darf' && 'DARF — tributos federais (IRPJ, PIS, Cofins, etc.)'}
              {tipo === 'gnre' && 'GNRE — ICMS interestadual entre UFs.'}
              {tipo === 'gare' && 'GARE-ICMS — Estado de São Paulo.'}
            </p>
          </div>

          {/* Código + período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tipo === 'darf' ? (
              <div>
                <label className="block text-small text-fg-2 mb-1.5">Código de receita *</label>
                <select
                  className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                  value={codigoReceita}
                  onChange={(e) => setCodigoReceita(e.target.value)}
                >
                  {CODIGOS_DARF.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <Input
                label="Código de receita *"
                placeholder="Ex.: 100099"
                value={codigoReceita}
                onChange={(e) => setCodigoReceita(e.target.value)}
                required
              />
            )}
            <Input
              label="Período de apuração * (YYYYMM)"
              placeholder="202605"
              value={periodoApuracao}
              onChange={(e) => setPeriodoApuracao(e.target.value)}
              required
            />
          </div>

          {/* Contribuinte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="CNPJ/CPF do contribuinte *"
              placeholder="00.000.000/0000-00"
              value={contribuinteDoc}
              onChange={(e) => setContribuinteDoc(e.target.value)}
              required
            />
            <Input
              label="Razão social / Nome *"
              placeholder="BH Grain Trading LTDA"
              value={contribuinteNome}
              onChange={(e) => setContribuinteNome(e.target.value)}
              required
            />
          </div>

          {/* GNRE/GARE — UF e IE */}
          {tipo !== 'darf' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-small text-fg-2 mb-1.5">UF *</label>
                <select
                  className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                >
                  {UF_LIST.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              {tipo === 'gare' && (
                <Input
                  label="Inscrição Estadual (opcional)"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Valor principal (R$) *"
              placeholder="0,00"
              value={valorPrincipal}
              onChange={(e) => setValorPrincipal(e.target.value)}
              required
            />
            <Input
              label="Multa (R$)"
              placeholder="0,00"
              value={multa}
              onChange={(e) => setMulta(e.target.value)}
            />
            <Input
              label="Juros (R$)"
              placeholder="0,00"
              value={juros}
              onChange={(e) => setJuros(e.target.value)}
            />
          </div>

          <Input
            label="Vencimento *"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            required
          />

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Observações (opcional)
            </label>
            <textarea
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Gerando…' : 'Gerar guia'}
            </Button>
            <Link href="/fiscal/guias">
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
