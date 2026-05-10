'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card as PhbCard, Button } from '@/components/ui/phb'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <PhbCard className="p-5">
      <div className="mb-4">
        <h3 className="text-h3 font-sans tracking-tight text-fg-1">{title}</h3>
        {subtitle && <p className="text-fg-3 text-small mt-1">{subtitle}</p>}
      </div>
      {children}
    </PhbCard>
  )
}

interface Props {
  initial: any | null
}

export function ConfiguracaoForm({ initial }: Props) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; mensagem: string; provider?: string } | null>(null)

  const [form, setForm] = React.useState({
    cnpjEmissor: initial?.cnpjEmissor ?? '',
    inscricaoEstadual: initial?.inscricaoEstadual ?? '',
    inscricaoMunicipal: initial?.inscricaoMunicipal ?? '',
    regimeTributario: initial?.regimeTributario ?? 'lucro_presumido',
    cnae: initial?.cnae ?? '',
    providerNome: initial?.providerNome ?? 'mock',
    providerCompanyId: initial?.providerCompanyId ?? '',
    ambiente: initial?.ambiente ?? 'homologacao',
    certificadoUrl: initial?.certificadoUrl ?? '',
    certificadoVencimento: initial?.certificadoVencimento ? String(initial.certificadoVencimento).slice(0, 10) : '',
    certificadoAlias: initial?.certificadoAlias ?? '',
    serieNFe: initial?.serieNFe ?? 1,
    proximoNumeroNFe: initial?.proximoNumeroNFe ?? 1,
    serieNFeContingencia: initial?.serieNFeContingencia ?? '',
    cfopCompraProdutorPF: initial?.cfopCompraProdutorPF ?? '1102',
    cfopCompraProdutorPJ: initial?.cfopCompraProdutorPJ ?? '1102',
    cfopVendaInterestadual: initial?.cfopVendaInterestadual ?? '6101',
    cfopVendaIntraestadual: initial?.cfopVendaIntraestadual ?? '5101',
    funruralAplicar: initial?.funruralAplicar ?? true,
    funruralAliquota: initial?.funruralAliquota ?? 1.3,
    cnaeSped: initial?.cnaeSped ?? '',
    ativo: initial?.ativo ?? true,
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const certVenc = form.certificadoVencimento ? new Date(form.certificadoVencimento) : null
  const certVencido = certVenc && certVenc < new Date()
  const alertaProd = form.ambiente === 'producao' && certVencido

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch('/api/fiscal/configuracao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          serieNFe: Number(form.serieNFe),
          proximoNumeroNFe: Number(form.proximoNumeroNFe),
          serieNFeContingencia: form.serieNFeContingencia ? Number(form.serieNFeContingencia) : null,
          funruralAliquota: Number(form.funruralAliquota),
          certificadoVencimento: form.certificadoVencimento || null,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(`Erro: ${err.error ?? r.status}`)
        return
      }
      router.refresh()
      alert('Configuração salva')
    } finally {
      setSaving(false)
    }
  }

  async function testarConexao() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/fiscal/configuracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'testar_conexao' }),
      })
      const data = await r.json()
      setTestResult(data)
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-6">
      {alertaProd && (
        <div className="flex items-start gap-3 p-4 rounded-md border border-neg bg-neg/10">
          <AlertTriangle className="h-5 w-5 text-neg shrink-0" />
          <div className="text-small">
            <strong className="text-neg">Certificado vencido em ambiente de produção.</strong>
            <p className="text-fg-2 mt-1">Renove o certificado A1 antes de emitir NF-e reais.</p>
          </div>
        </div>
      )}

      <Card title="Emissor" subtitle="Dados da pessoa jurídica que emite NF-e">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CNPJ emissor *">
            <input className="phb-input" value={form.cnpjEmissor} onChange={(e) => update('cnpjEmissor', e.target.value)} placeholder="00.000.000/0001-00" required />
          </Field>
          <Field label="Inscrição estadual">
            <input className="phb-input" value={form.inscricaoEstadual} onChange={(e) => update('inscricaoEstadual', e.target.value)} />
          </Field>
          <Field label="Inscrição municipal">
            <input className="phb-input" value={form.inscricaoMunicipal} onChange={(e) => update('inscricaoMunicipal', e.target.value)} />
          </Field>
          <Field label="CNAE">
            <input className="phb-input" value={form.cnae} onChange={(e) => update('cnae', e.target.value)} placeholder="46.21-4-00" />
          </Field>
          <Field label="Regime tributário *">
            <select className="phb-input" value={form.regimeTributario} onChange={(e) => update('regimeTributario', e.target.value)}>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
              <option value="mei">MEI</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Provider de emissão" subtitle="Serviço externo que comunica com a SEFAZ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Provider">
            <select className="phb-input" value={form.providerNome} onChange={(e) => update('providerNome', e.target.value)}>
              <option value="mock">Mock (sem emissão real)</option>
              <option value="nfeio">NFE.io</option>
              <option value="enotas">eNotas (em breve)</option>
              <option value="webmania">Webmania (em breve)</option>
              <option value="tecnospeed">Tecnospeed (em breve)</option>
            </select>
          </Field>
          <Field label="Company ID do provider">
            <input className="phb-input" value={form.providerCompanyId} onChange={(e) => update('providerCompanyId', e.target.value)} placeholder="ID da empresa cadastrada no provider" />
          </Field>
          <Field label="Ambiente *">
            <select className="phb-input" value={form.ambiente} onChange={(e) => update('ambiente', e.target.value)}>
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção (real)</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={testarConexao} disabled={testing}>
              {testing ? 'Testando…' : 'Testar conexão com provider'}
            </Button>
          </div>
          {testResult && (
            <div className={`md:col-span-2 flex items-center gap-2 text-small ${testResult.ok ? 'text-pos' : 'text-neg'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{testResult.mensagem} {testResult.provider ? `(${testResult.provider})` : ''}</span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Certificado digital A1" subtitle="Arquivo PKCS#12 (.pfx) — armazenado no Supabase Storage">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="URL do certificado">
            <input className="phb-input" value={form.certificadoUrl} onChange={(e) => update('certificadoUrl', e.target.value)} placeholder="https://supabase.../certificado.pfx" />
          </Field>
          <Field label="Alias / titular">
            <input className="phb-input" value={form.certificadoAlias} onChange={(e) => update('certificadoAlias', e.target.value)} />
          </Field>
          <Field label="Vencimento">
            <input type="date" className="phb-input" value={form.certificadoVencimento} onChange={(e) => update('certificadoVencimento', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Numeração NF-e" subtitle="Série e próximo número (cuidado: alterar pode causar gap)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Série *">
            <input type="number" min={1} className="phb-input" value={form.serieNFe} onChange={(e) => update('serieNFe', Number(e.target.value) as any)} />
          </Field>
          <Field label="Próximo número *">
            <input type="number" min={1} className="phb-input" value={form.proximoNumeroNFe} onChange={(e) => update('proximoNumeroNFe', Number(e.target.value) as any)} />
          </Field>
          <Field label="Série contingência">
            <input type="number" className="phb-input" value={form.serieNFeContingencia} onChange={(e) => update('serieNFeContingencia', e.target.value as any)} />
          </Field>
        </div>
      </Card>

      <Card title="Padrões CFOP" subtitle="Operações típicas — podem ser sobrescritos por nota">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Compra produtor PF">
            <input className="phb-input" value={form.cfopCompraProdutorPF} onChange={(e) => update('cfopCompraProdutorPF', e.target.value)} />
          </Field>
          <Field label="Compra produtor PJ">
            <input className="phb-input" value={form.cfopCompraProdutorPJ} onChange={(e) => update('cfopCompraProdutorPJ', e.target.value)} />
          </Field>
          <Field label="Venda intra-estadual">
            <input className="phb-input" value={form.cfopVendaIntraestadual} onChange={(e) => update('cfopVendaIntraestadual', e.target.value)} />
          </Field>
          <Field label="Venda inter-estadual">
            <input className="phb-input" value={form.cfopVendaInterestadual} onChange={(e) => update('cfopVendaInterestadual', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="FUNRURAL" subtitle="Retenção em compras de produtor pessoa física">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Aplicar FUNRURAL">
            <label className="flex items-center gap-2 text-small text-fg-2">
              <input type="checkbox" checked={form.funruralAplicar} onChange={(e) => update('funruralAplicar', e.target.checked)} />
              Reter automaticamente em compras de PF
            </label>
          </Field>
          <Field label="Alíquota (%)">
            <input type="number" step="0.01" className="phb-input" value={form.funruralAliquota} onChange={(e) => update('funruralAliquota', Number(e.target.value) as any)} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configuração'}</Button>
      </div>

      <style jsx global>{`
        .phb-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-2);
          border: 1px solid var(--border-1);
          border-radius: 6px;
          color: var(--fg-1);
          font-size: 0.875rem;
        }
        .phb-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
      `}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-micro uppercase tracking-wider text-fg-3">{label}</span>
      {children}
    </label>
  )
}
