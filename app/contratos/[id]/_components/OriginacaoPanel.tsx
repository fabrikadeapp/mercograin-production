'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  Chip,
  Dialog,
  Input,
  Select,
  ProgressBar,
} from '@/components/ui/phb'
import { Plus, Target, Triangle, AlertTriangle } from 'lucide-react'

interface FixacaoItem {
  id: string
  qtdSc: number
  precoSc: number
  premio?: number | null
  base?: number | null
  fixadoEm: string
}

interface ContratoFixacaoData {
  id: string
  modalidade: string
  qtdTotalSc: number
  qtdFixadaSc: number
  qtdRemanescenteSc: number
  fixacaoFim: string | null
  statusFixacao: string
  fixacoes: FixacaoItem[]
}

interface OriginacaoPanelProps {
  contratoId: string
  modalidade: string
  isAdmin: boolean
  qtdContratoSugerida?: number
}

const MODALIDADE_LABEL: Record<string, string> = {
  fixo: 'Fixo',
  a_fixar: 'A Fixar',
  misto: 'Misto',
  barter: 'Barter',
  triangular: 'Triangular',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function OriginacaoPanel({
  contratoId,
  modalidade,
  isAdmin,
  qtdContratoSugerida,
}: OriginacaoPanelProps) {
  const router = useRouter()
  const [data, setData] = React.useState<ContratoFixacaoData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [openFix, setOpenFix] = React.useState(false)
  const [openWashout, setOpenWashout] = React.useState(false)
  const [openTriangular, setOpenTriangular] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/contratos/${contratoId}/fixacoes`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contratoId])

  const isAFixar =
    modalidade === 'a_fixar' ||
    modalidade === 'misto' ||
    (data && data.modalidade !== 'fixo')

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-micro text-fg-3 uppercase">Modalidade</div>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-h3 text-fg-1">
              {MODALIDADE_LABEL[modalidade] || modalidade}
            </h3>
            {data && (
              <Chip
                variant={
                  data.statusFixacao === 'totalmente_fixado'
                    ? 'pos'
                    : data.statusFixacao === 'cancelado'
                      ? 'neg'
                      : 'neutral'
                }
              >
                {data.statusFixacao.replace('_', ' ')}
              </Chip>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAFixar || !data ? (
            <Button variant="primary" onClick={() => setOpenFix(true)}>
              <Target className="h-4 w-4 mr-1" /> Nova fixação
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setOpenTriangular(true)}>
            <Triangle className="h-4 w-4 mr-1" /> Triangular
          </Button>
          {isAdmin ? (
            <Button variant="ghost" onClick={() => setOpenWashout(true)}>
              <AlertTriangle className="h-4 w-4 mr-1" /> Washout
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-fg-3 text-small">Carregando fixações...</p>
      ) : !data ? (
        <p className="text-fg-3 text-small">
          Contrato sem configuração de fixação. Clique em "Nova fixação" para
          começar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-micro text-fg-3 uppercase">Total</div>
              <div className="t-num text-h3 text-fg-1">
                {fmt(data.qtdTotalSc)} sc
              </div>
            </div>
            <div>
              <div className="text-micro text-fg-3 uppercase">Fixada</div>
              <div className="t-num text-h3 text-fg-1">
                {fmt(data.qtdFixadaSc)} sc
              </div>
            </div>
            <div>
              <div className="text-micro text-fg-3 uppercase">Remanescente</div>
              <div className="t-num text-h3 text-emerald-400">
                {fmt(data.qtdRemanescenteSc)} sc
              </div>
            </div>
          </div>

          <ProgressBar
            value={
              data.qtdTotalSc > 0
                ? (data.qtdFixadaSc / data.qtdTotalSc) * 100
                : 0
            }
          />

          {data.fixacoes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-border-1">
              <table className="w-full text-small">
                <thead className="bg-bg-2 text-fg-3 text-micro uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-right">Qtd (sc)</th>
                    <th className="px-3 py-2 text-right">Preço (R$/sc)</th>
                    <th className="px-3 py-2 text-right">Prêmio</th>
                    <th className="px-3 py-2 text-right">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fixacoes.map((f) => (
                    <tr key={f.id} className="border-t border-border-1">
                      <td className="px-3 py-2 text-fg-2">
                        {new Date(f.fixadoEm).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 text-right t-num text-fg-1">
                        {fmt(f.qtdSc)}
                      </td>
                      <td className="px-3 py-2 text-right t-num text-fg-1">
                        {fmt(f.precoSc)}
                      </td>
                      <td className="px-3 py-2 text-right t-num text-fg-3">
                        {f.premio ? fmt(f.premio) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right t-num text-fg-3">
                        {f.base ? fmt(f.base) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <FixacaoDialog
        open={openFix}
        onClose={() => setOpenFix(false)}
        contratoId={contratoId}
        existing={data}
        qtdContratoSugerida={qtdContratoSugerida}
        onDone={() => {
          setOpenFix(false)
          fetch(`/api/contratos/${contratoId}/fixacoes`)
            .then((r) => r.json())
            .then((j) => setData(j.data))
          router.refresh()
        }}
      />
      <WashoutDialog
        open={openWashout}
        onClose={() => setOpenWashout(false)}
        contratoId={contratoId}
        qtdSugerida={qtdContratoSugerida || 0}
        onDone={() => {
          setOpenWashout(false)
          router.refresh()
        }}
      />
      <TriangularDialog
        open={openTriangular}
        onClose={() => setOpenTriangular(false)}
        contratoId={contratoId}
        onDone={() => {
          setOpenTriangular(false)
          router.refresh()
        }}
      />
    </Card>
  )
}

// ---------- Sub-dialogs ----------

function FixacaoDialog({
  open,
  onClose,
  contratoId,
  existing,
  qtdContratoSugerida,
  onDone,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  existing: ContratoFixacaoData | null
  qtdContratoSugerida?: number
  onDone: () => void
}) {
  const [qtdSc, setQtdSc] = React.useState<number>(0)
  const [precoSc, setPrecoSc] = React.useState<number>(0)
  const [premio, setPremio] = React.useState<number>(0)
  const [base, setBase] = React.useState<number>(0)
  const [setupQtdTotalSc, setSetupQtdTotalSc] = React.useState<number>(
    qtdContratoSugerida || 0
  )
  const [setupModalidade, setSetupModalidade] = React.useState<
    'a_fixar' | 'misto'
  >('a_fixar')
  const [setupFim, setSetupFim] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [warn, setWarn] = React.useState<string[]>([])

  async function submit() {
    setSaving(true)
    setErr(null)
    setWarn([])
    try {
      const body: any = {
        qtdSc: Number(qtdSc),
        precoSc: Number(precoSc),
        premio: premio ? Number(premio) : undefined,
        base: base ? Number(base) : undefined,
      }
      if (!existing) {
        body.setupQtdTotalSc = Number(setupQtdTotalSc)
        body.setupModalidade = setupModalidade
        if (setupFim)
          body.setupFixacaoFim = new Date(setupFim).toISOString()
      }
      const r = await fetch(`/api/contratos/${contratoId}/fixacoes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao fixar')
      if (j.alertas?.length) setWarn(j.alertas)
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nova fixação"
      description={
        existing
          ? `Saldo remanescente: ${existing.qtdRemanescenteSc.toLocaleString('pt-BR')} sc`
          : 'Configure este contrato como "a fixar" e registre a primeira fixação.'
      }
      footer={
        <Button
          variant="primary"
          onClick={submit}
          disabled={saving || !qtdSc || !precoSc}
        >
          {saving ? 'Fixando...' : 'Confirmar fixação'}
        </Button>
      }
    >
      {err ? (
        <div className="mb-3 p-3 rounded-md border border-neg/40 bg-neg/10 text-neg text-small">
          {err}
        </div>
      ) : null}
      {warn.length > 0 ? (
        <div className="mb-3 p-3 rounded-md border border-warn/40 bg-warn/10 text-warn text-small">
          {warn.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      ) : null}
      <div className="space-y-3">
        {!existing && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Qtd total a fixar (sc)"
                type="number"
                step="0.01"
                value={setupQtdTotalSc || ''}
                onChange={(e) => setSetupQtdTotalSc(Number(e.target.value))}
              />
              <Select
                label="Modalidade"
                value={setupModalidade}
                onChange={(e) =>
                  setSetupModalidade(e.target.value as 'a_fixar' | 'misto')
                }
                options={[
                  { value: 'a_fixar', label: 'A Fixar' },
                  { value: 'misto', label: 'Misto' },
                ]}
              />
            </div>
            <Input
              label="Janela final de fixação (opcional)"
              type="date"
              value={setupFim}
              onChange={(e) => setSetupFim(e.target.value)}
            />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Qtd a fixar agora (sc)"
            type="number"
            step="0.01"
            value={qtdSc || ''}
            onChange={(e) => setQtdSc(Number(e.target.value))}
          />
          <Input
            label="Preço (R$/sc)"
            type="number"
            step="0.01"
            value={precoSc || ''}
            onChange={(e) => setPrecoSc(Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prêmio (R$/sc) — opcional"
            type="number"
            step="0.01"
            value={premio || ''}
            onChange={(e) => setPremio(Number(e.target.value))}
          />
          <Input
            label="Base (R$/sc) — opcional"
            type="number"
            step="0.01"
            value={base || ''}
            onChange={(e) => setBase(Number(e.target.value))}
          />
        </div>
      </div>
    </Dialog>
  )
}

function WashoutDialog({
  open,
  onClose,
  contratoId,
  qtdSugerida,
  onDone,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  qtdSugerida: number
  onDone: () => void
}) {
  const [motivo, setMotivo] = React.useState<
    'cliente_desistiu' | 'forcas_maior' | 'preco_inviavel' | 'outro'
  >('cliente_desistiu')
  const [motivoDescricao, setMotivoDescricao] = React.useState('')
  const [custoWashout, setCustoWashout] = React.useState<number>(0)
  const [custoQuemPaga, setCustoQuemPaga] = React.useState<
    'comprador' | 'vendedor' | 'corretora' | ''
  >('')
  const [qtdAfetadaSc, setQtdAfetadaSc] = React.useState<number>(qtdSugerida)
  const [impacto, setImpacto] = React.useState<any>(null)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setQtdAfetadaSc(qtdSugerida)
  }, [qtdSugerida])

  async function preview() {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch(`/api/contratos/${contratoId}/washout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          motivo,
          motivoDescricao: motivoDescricao || undefined,
          custoWashout: Number(custoWashout) || 0,
          custoQuemPaga: custoQuemPaga || undefined,
          qtdAfetadaSc: Number(qtdAfetadaSc),
          executar: false,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setImpacto(j.impacto)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function executar() {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch(`/api/contratos/${contratoId}/washout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          motivo,
          motivoDescricao: motivoDescricao || undefined,
          custoWashout: Number(custoWashout) || 0,
          custoQuemPaga: custoQuemPaga || undefined,
          qtdAfetadaSc: Number(qtdAfetadaSc),
          executar: true,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Washout — desfazer contrato"
      description="Calcula impacto antes de executar (cancela contrato + fixações)."
      footer={
        <>
          <Button variant="ghost" onClick={preview} disabled={saving}>
            Calcular impacto
          </Button>
          <Button
            variant="primary"
            onClick={executar}
            disabled={saving || !qtdAfetadaSc}
          >
            {saving ? 'Processando...' : 'Executar washout'}
          </Button>
        </>
      }
    >
      {err ? (
        <div className="mb-3 p-3 rounded-md border border-neg/40 bg-neg/10 text-neg text-small">
          {err}
        </div>
      ) : null}
      <div className="space-y-3">
        <Select
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as any)}
          options={[
            { value: 'cliente_desistiu', label: 'Cliente desistiu' },
            { value: 'forcas_maior', label: 'Forças maiores' },
            { value: 'preco_inviavel', label: 'Preço inviável' },
            { value: 'outro', label: 'Outro' },
          ]}
        />
        <Input
          label="Descrição"
          value={motivoDescricao}
          onChange={(e) => setMotivoDescricao(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Custo washout (R$)"
            type="number"
            step="0.01"
            value={custoWashout || ''}
            onChange={(e) => setCustoWashout(Number(e.target.value))}
          />
          <Select
            label="Quem paga"
            value={custoQuemPaga}
            onChange={(e) => setCustoQuemPaga(e.target.value as any)}
            options={[
              { value: '', label: '—' },
              { value: 'comprador', label: 'Comprador' },
              { value: 'vendedor', label: 'Vendedor' },
              { value: 'corretora', label: 'Corretora' },
            ]}
          />
        </div>
        <Input
          label="Qtd afetada (sc)"
          type="number"
          step="0.01"
          value={qtdAfetadaSc || ''}
          onChange={(e) => setQtdAfetadaSc(Number(e.target.value))}
        />
        {impacto ? (
          <div className="rounded-md p-3 bg-bg-2 border border-border-1 text-small space-y-1">
            <div className="text-fg-3 uppercase text-micro">Impacto estimado</div>
            <div>Qtd liberada: {impacto.qtdLiberada.toFixed(2)} sc</div>
            <div>
              Custo total: R$ {impacto.custoTotalEstimado.toFixed(2)}
              {impacto.valorAReembolsar > 0 && (
                <span className="text-fg-3">
                  {' '}
                  (inclui R$ {impacto.valorAReembolsar.toFixed(2)} de
                  reembolso de adiantamentos)
                </span>
              )}
            </div>
            <div>
              Fixações canceladas: {impacto.fixacoesCanceladas} (
              {impacto.qtdFixacoesCanceladasSc.toFixed(2)} sc)
            </div>
            {impacto.alertas.map((a: string, i: number) => (
              <div key={i} className="text-warn">
                ⚠ {a}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function TriangularDialog({
  open,
  onClose,
  contratoId,
  onDone,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  onDone: () => void
}) {
  const [numero, setNumero] = React.useState(
    `CT-TRI-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
  )
  const [clienteIdFilho, setClienteIdFilho] = React.useState('')
  const [clientes, setClientes] = React.useState<
    { id: string; nome: string }[]
  >([])
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    fetch('/api/clientes?limit=200')
      .then((r) => r.json())
      .then((j) => setClientes(j.data || []))
      .catch(() => {})
  }, [open])

  async function submit() {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch(`/api/contratos/${contratoId}/triangular`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numero, clienteIdFilho }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Operação triangular"
      description="Cria contrato filho ligado a este como origem."
      footer={
        <Button
          variant="primary"
          onClick={submit}
          disabled={saving || !clienteIdFilho || !numero}
        >
          {saving ? 'Criando...' : 'Criar contrato filho'}
        </Button>
      }
    >
      {err ? (
        <div className="mb-3 p-3 rounded-md border border-neg/40 bg-neg/10 text-neg text-small">
          {err}
        </div>
      ) : null}
      <div className="space-y-3">
        <Input
          label="Número do contrato filho"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <Select
          label="Cliente do contrato filho"
          value={clienteIdFilho}
          onChange={(e) => setClienteIdFilho(e.target.value)}
          options={[
            { value: '', label: 'Selecione...' },
            ...clientes.map((c) => ({ value: c.id, label: c.nome })),
          ]}
        />
      </div>
    </Dialog>
  )
}
