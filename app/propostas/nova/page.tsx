'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2, Wheat, Loader2, Calculator } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'
import { KG_POR_BU, KG_POR_SC, type Grao as GraoKey } from '@/lib/cotacoes/unidades'

interface Cliente {
  id: string
  nome: string
}

// Unidades suportadas no formulário de proposta.
// Internamente sempre armazenamos quantidade em TONELADAS e preço em R$/T.
// As variantes de display são convertidas no momento do input/output.
type UnidadeQtd = 't' | 'sc60' | 'kg'
type UnidadePreco = 'brlTon' | 'brlSc60' | 'brlKg' | 'usdBu'

interface GraoItem {
  grao: string
  /** Sempre em toneladas (canônico). */
  quantidade: number
  /** Sempre em R$/t (canônico). */
  preco: number
  /** R$ total (qtde × preco). */
  subtotal: number
  /** Unidade exibida no input de quantidade (não afeta storage). */
  unidadeQtd?: UnidadeQtd
  /** Unidade exibida no input de preço (não afeta storage). */
  unidadePreco?: UnidadePreco
}

const UNIDADE_QTD_LABEL: Record<UnidadeQtd, string> = {
  t: 't',
  sc60: 'sc 60kg',
  kg: 'kg',
}

const UNIDADE_PRECO_LABEL: Record<UnidadePreco, string> = {
  brlTon: 'R$/t',
  brlSc60: 'R$/sc',
  brlKg: 'R$/kg',
  usdBu: 'US$/bu',
}

/** Converte quantidade exibida → toneladas canônicas. */
function qtdParaTon(valor: number, unidade: UnidadeQtd, grao: string): number {
  if (unidade === 't') return valor
  const kgPorSc = KG_POR_SC[grao as GraoKey] ?? 60
  if (unidade === 'sc60') return (valor * kgPorSc) / 1000
  if (unidade === 'kg') return valor / 1000
  return valor
}

/** Converte toneladas canônicas → unidade exibida. */
function tonParaQtd(ton: number, unidade: UnidadeQtd, grao: string): number {
  if (unidade === 't') return ton
  const kgPorSc = KG_POR_SC[grao as GraoKey] ?? 60
  if (unidade === 'sc60') return (ton * 1000) / kgPorSc
  if (unidade === 'kg') return ton * 1000
  return ton
}

/** Converte preço exibido → R$/t canônico (precisa USDBRL para US$/bu). */
function precoParaBrlTon(valor: number, unidade: UnidadePreco, grao: string, usdbrl: number | null): number {
  if (unidade === 'brlTon') return valor
  const kgPorSc = KG_POR_SC[grao as GraoKey] ?? 60
  const kgPorBu = KG_POR_BU[grao as GraoKey] ?? 27.2155
  if (unidade === 'brlSc60') return (valor / kgPorSc) * 1000 // R$/sc → R$/kg → R$/t
  if (unidade === 'brlKg') return valor * 1000
  if (unidade === 'usdBu') {
    if (!usdbrl || usdbrl <= 0) return 0
    return (valor * usdbrl * 1000) / kgPorBu
  }
  return valor
}

/** Converte R$/t canônico → unidade exibida. */
function brlTonParaPreco(brlTon: number, unidade: UnidadePreco, grao: string, usdbrl: number | null): number {
  if (unidade === 'brlTon') return brlTon
  const kgPorSc = KG_POR_SC[grao as GraoKey] ?? 60
  const kgPorBu = KG_POR_BU[grao as GraoKey] ?? 27.2155
  if (unidade === 'brlSc60') return (brlTon / 1000) * kgPorSc
  if (unidade === 'brlKg') return brlTon / 1000
  if (unidade === 'usdBu') {
    if (!usdbrl || usdbrl <= 0) return 0
    return ((brlTon / 1000) * kgPorBu) / usdbrl
  }
  return brlTon
}

const propostaSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  tipo: z.enum(['venda', 'compra'], { errorMap: () => ({ message: 'Tipo inválido' }) }),
  descricao: z.string().optional(),
  validadeEm: z.string().min(1, 'Data de validade é obrigatória'),
})

type PropostaFormData = z.infer<typeof propostaSchema>

const GRAOS_DISPONIVEIS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'algodao', label: 'Algodão' },
  { value: 'cafe', label: 'Café' },
  { value: 'arroz', label: 'Arroz' },
]

const TIPO_OPCOES = [
  { value: 'venda', label: 'Venda' },
  { value: 'compra', label: 'Compra' },
]

export default function NovaPropostaPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [graos, setGraos] = useState<GraoItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usdbrl, setUsdbrl] = useState<number | null>(null)
  /** Map { soja: 0.3, milho: 0.4 } vindo de /api/bhgrain/margins */
  const [marginsMap, setMarginsMap] = useState<Record<string, number>>({})

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: { tipo: 'venda' },
  })

  useEffect(() => {
    fetchClientes()
    // Câmbio USDBRL leve — só pra conversão US$/bu ↔ R$ no form.
    fetch('/api/bhgrain/cbot')
      .then((r) => r.json())
      .then((j) => {
        if (j?.usdbrl?.price) setUsdbrl(j.usdbrl.price)
      })
      .catch(() => {})
    // Margens default por commodity — preenche o campo automaticamente
    // quando o cliente seleciona o grão.
    fetch('/api/bhgrain/margins')
      .then((r) => r.json())
      .then((j) => {
        if (j?.margins) setMarginsMap(j.margins as Record<string, number>)
      })
      .catch(() => {})
  }, [])

  const fetchClientes = async () => {
    try {
      const response = await fetch('/api/clientes?limit=200')
      if (!response.ok) throw new Error('Erro ao buscar clientes')
      const json = await response.json()
      // API retorna { data: [...], pagination } ou array direto (compat)
      const list = Array.isArray(json) ? json : (json.data ?? [])
      setClientes(list)
    } catch (err) {
      showError('Erro ao carregar clientes')
      console.error(err)
    } finally {
      setLoadingClientes(false)
    }
  }

  const handleAddGrao = () => {
    setGraos((prev) => [
      ...prev,
      { grao: 'soja', quantidade: 0, preco: 0, subtotal: 0, unidadeQtd: 't', unidadePreco: 'brlTon' },
    ])
  }

  const handleUnidadeQtdChange = (index: number, novaUnidade: UnidadeQtd) => {
    setGraos((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], unidadeQtd: novaUnidade }
      return updated
    })
  }

  const handleUnidadePrecoChange = (index: number, novaUnidade: UnidadePreco) => {
    setGraos((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], unidadePreco: novaUnidade }
      return updated
    })
  }

  const handleRemoveGrao = (index: number) => {
    setGraos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGraoChange = (
    index: number,
    field: keyof GraoItem,
    value: string | number
  ) => {
    setGraos((prev) => {
      const updated = [...prev]
      const grao = updated[index]

      if (field === 'quantidade' || field === 'preco') {
        const quantidade = field === 'quantidade' ? (value as number) : grao.quantidade
        const preco = field === 'preco' ? (value as number) : grao.preco
        grao[field] = value as never
        grao.subtotal = Math.round(quantidade * preco * 100) / 100
      } else {
        grao[field] = value as never
      }

      return updated
    })
  }

  const valorTotal = graos.reduce((acc, g) => acc + g.subtotal, 0)

  const onInvalid = (errs: typeof errors) => {
    const labels: Record<string, string> = {
      clienteId: 'Cliente',
      numero: 'Número da proposta',
      tipo: 'Tipo',
      validadeEm: 'Data de validade',
    }
    const missing = Object.keys(errs)
      .map((k) => labels[k] ?? k)
      .filter(Boolean)
    if (missing.length > 0) {
      showError(`Preencha: ${missing.join(', ')}`)
    }
    // Scroll até o primeiro campo com erro
    setTimeout(() => {
      const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstError.focus?.()
      }
    }, 50)
  }

  const onSubmit = async (data: PropostaFormData) => {
    if (graos.length === 0) {
      showError('Adicione pelo menos um grão')
      return
    }

    // Valida grãos individualmente (não vão pelo zod porque estão em state separado)
    const graoInvalido = graos.findIndex((g) => !g.grao || g.quantidade <= 0 || g.preco <= 0)
    if (graoInvalido >= 0) {
      showError(`Grão #${graoInvalido + 1}: preencha grão, quantidade e preço (> 0)`)
      return
    }

    setSaving(true)

    try {
      const payload = { ...data, graos, valor: valorTotal }

      const response = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erro ao criar proposta')
      }

      success('Proposta criada com sucesso!')
      router.push('/propostas')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar proposta')
    } finally {
      setSaving(false)
    }
  }

  if (loadingClientes) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      </AppShell>
    )
  }

  const clienteOptions = [
    { value: '', label: 'Selecione um cliente' },
    ...clientes.map((c) => ({ value: c.id, label: c.nome })),
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Comercial · Nova proposta"
        title="Nova proposta"
        subtitle="Crie uma proposta comercial com especificação de grãos e validade."
        search={false}
        actions={
          <>
            <Link
              href={`/calculadora?from=proposta${
                graos[0]?.grao ? `&grao=${graos[0].grao}` : ''
              }${graos[0]?.preco ? `&preco=${graos[0].preco}` : ''}${
                graos[0]?.quantidade ? `&quantidade=${graos[0].quantidade}` : ''
              }`}
            >
              <Button variant="secondary" leftIcon={<Calculator className="h-4 w-4" />}>
                Calcular líquido
              </Button>
            </Link>
            <Link href="/propostas">
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Voltar
              </Button>
            </Link>
          </>
        }
      />

      {clientes.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <p className="eyebrow">Pré-requisito</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Cadastre um cliente primeiro
          </h3>
          <p className="text-fg-2 text-body">
            Você precisa de pelo menos um cliente para criar uma proposta.
          </p>
          <div className="pt-2">
            <Link href="/clientes/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Criar cliente</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          <Card className="space-y-6">
            <section className="space-y-4">
              <p className="eyebrow">Dados da proposta</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Cliente *"
                  options={clienteOptions}
                  {...register('clienteId')}
                  error={errors.clienteId?.message}
                />
                <Input
                  label="Número da proposta *"
                  placeholder="EX: PROP-2024-001"
                  {...register('numero')}
                  error={errors.numero?.message}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Tipo *"
                  options={TIPO_OPCOES}
                  {...register('tipo')}
                  error={errors.tipo?.message}
                />
                <Input
                  label="Válida até *"
                  type="date"
                  {...register('validadeEm')}
                  error={errors.validadeEm?.message}
                />
              </div>
              <div className="space-y-1.5">
                <label className="eyebrow">Descrição · Observações</label>
                <textarea
                  {...register('descricao')}
                  rows={3}
                  placeholder="Detalhes adicionais da proposta"
                  className="w-full px-4 py-3 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
                />
              </div>
            </section>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wheat className="h-4 w-4 text-accent" />
                <h3 className="text-fg-1 font-semibold">Especificação de grãos</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={handleAddGrao}
              >
                Adicionar grão
              </Button>
            </div>

            {graos.length === 0 ? (
              <div className="rounded-md bg-bg-2 border border-border-1 border-dashed p-6 text-center text-fg-3 text-small">
                Adicione pelo menos um grão para esta proposta.
              </div>
            ) : (
              <div className="space-y-3">
                {graos.map((grao, index) => {
                  const uQtd: UnidadeQtd = grao.unidadeQtd ?? 't'
                  const uPreco: UnidadePreco = grao.unidadePreco ?? 'brlTon'
                  const qtdExibida = tonParaQtd(grao.quantidade, uQtd, grao.grao)
                  const precoExibido = brlTonParaPreco(grao.preco, uPreco, grao.grao, usdbrl)
                  return (
                    <div
                      key={index}
                      className="rounded-md bg-bg-2 border border-border-1 p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Select
                          label="Grão"
                          options={GRAOS_DISPONIVEIS}
                          value={grao.grao}
                          onChange={(e) => handleGraoChange(index, 'grao', e.target.value)}
                        />
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="eyebrow">
                              Quantidade ({UNIDADE_QTD_LABEL[uQtd]})
                            </label>
                            <div className="flex gap-1">
                              {(['t', 'sc60', 'kg'] as UnidadeQtd[]).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => handleUnidadeQtdChange(index, u)}
                                  className={uQtd === u ? 'chip active' : 'chip'}
                                  style={{ fontSize: 10, padding: '2px 6px' }}
                                  title={`Mostrar em ${UNIDADE_QTD_LABEL[u]}`}
                                >
                                  {UNIDADE_QTD_LABEL[u]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={qtdExibida ? Number(qtdExibida.toFixed(4)) : ''}
                            onChange={(e) => {
                              const novoExibido = parseFloat(e.target.value) || 0
                              const novoTon = qtdParaTon(novoExibido, uQtd, grao.grao)
                              handleGraoChange(index, 'quantidade', Math.round(novoTon * 10000) / 10000)
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="eyebrow">
                              Preço ({UNIDADE_PRECO_LABEL[uPreco]})
                            </label>
                            <div className="flex gap-1 flex-wrap">
                              {(['brlTon', 'brlSc60', 'brlKg', 'usdBu'] as UnidadePreco[]).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => handleUnidadePrecoChange(index, u)}
                                  className={uPreco === u ? 'chip active' : 'chip'}
                                  style={{ fontSize: 10, padding: '2px 6px' }}
                                  disabled={u === 'usdBu' && usdbrl == null}
                                  title={u === 'usdBu' && usdbrl == null ? 'Aguardando câmbio USD/BRL' : UNIDADE_PRECO_LABEL[u]}
                                >
                                  {UNIDADE_PRECO_LABEL[u]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={precoExibido ? Number(precoExibido.toFixed(uPreco === 'usdBu' ? 4 : 2)) : ''}
                            onChange={(e) => {
                              const novoExibido = parseFloat(e.target.value) || 0
                              const novoBrlTon = precoParaBrlTon(novoExibido, uPreco, grao.grao, usdbrl)
                              handleGraoChange(index, 'preco', Math.round(novoBrlTon * 100) / 100)
                            }}
                          />
                          {uPreco === 'usdBu' && usdbrl != null && (
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                              câmbio · R$ {usdbrl.toFixed(4)} /US$
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Equivalência sempre visível: mostra qtd × preço internos */}
                      <div
                        className="text-[10px]"
                        style={{ color: 'var(--text-dim)', fontFamily: 'var(--f-mono)' }}
                      >
                        ≡ {grao.quantidade.toFixed(3)} t × R${' '}
                        {grao.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /t
                      </div>

                      {/* Banner de margem default (vindo de /configuracoes/fluxo-trabalho) */}
                      {(() => {
                        const margemPercent = marginsMap[grao.grao]
                        if (margemPercent == null || margemPercent <= 0 || grao.preco <= 0) return null
                        const margemPorTon = grao.preco * (margemPercent / 100)
                        const margemPorSc = margemPorTon / (1000 / 60) // sacas de 60kg
                        const margemTotal = margemPorTon * grao.quantidade
                        return (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '8px 12px',
                              background: 'var(--accent-soft)',
                              border: '1px solid rgba(200, 240, 81, 0.25)',
                              borderRadius: 8,
                              fontSize: 11,
                              color: 'var(--text)',
                            }}
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span>
                                <strong style={{ color: 'var(--accent)' }}>
                                  Margem {margemPercent.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')}%
                                </strong>{' '}
                                <span style={{ color: 'var(--text-dim)' }}>
                                  · padrão configurado em Fluxo de trabalho
                                </span>
                              </span>
                              <span className="tabular-nums" style={{ color: 'var(--text-mute)' }}>
                                R$ {margemPorSc.toFixed(2).replace('.', ',')}/sc · R${' '}
                                {margemPorTon.toFixed(2).replace('.', ',')}/t · total{' '}
                                <strong style={{ color: 'var(--text)' }}>
                                  R$ {margemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                              </span>
                            </div>
                          </div>
                        )
                      })()}

                      <div className="flex items-center justify-between pt-2 border-t border-border-1">
                        <div>
                          <p className="eyebrow">Subtotal</p>
                          <p className="t-num text-fg-1 font-semibold">
                            {formatCurrency(grao.subtotal)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => handleRemoveGrao(index)}
                          className="text-neg hover:text-neg"
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="eyebrow">Valor total</p>
                <p className="text-fg-3 text-small">Soma dos subtotais</p>
              </div>
              <p className="t-num-lg text-accent">{formatCurrency(valorTotal)}</p>
            </div>

            {/* Resultado financeiro projetado (margem total) */}
            {(() => {
              let margemTotalBrl = 0
              let temAlgumaMargem = false
              for (const g of graos) {
                const m = marginsMap[g.grao]
                if (m != null && m > 0 && g.preco > 0) {
                  margemTotalBrl += g.preco * (m / 100) * g.quantidade
                  temAlgumaMargem = true
                }
              }
              if (!temAlgumaMargem || margemTotalBrl <= 0) return null
              const pctOverall = valorTotal > 0 ? (margemTotalBrl / valorTotal) * 100 : 0
              return (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 2 }}>Resultado projetado</p>
                    <p className="text-fg-3 text-small">
                      Margem agregada · {pctOverall.toFixed(2).replace('.', ',')}% sobre o valor total
                    </p>
                  </div>
                  <p
                    className="tabular-nums"
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: 'var(--success)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    R$ {margemTotalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )
            })()}
          </Card>

          {/* Resumo de erros — mostra todos os campos faltando antes do botão */}
          {Object.keys(errors).length > 0 && (
            <div
              className="rounded-md p-4"
              style={{
                background: 'var(--danger-soft)',
                border: '1px solid rgba(248,113,113,0.25)',
                color: 'var(--danger)',
              }}
            >
              <p className="font-medium mb-1">Preencha os campos obrigatórios:</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">
                {errors.clienteId && <li>Cliente</li>}
                {errors.numero && <li>Número da proposta</li>}
                {errors.tipo && <li>Tipo (venda/compra)</li>}
                {errors.validadeEm && <li>Data de validade</li>}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/propostas">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              {saving ? 'Criando…' : 'Criar proposta'}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  )
}
