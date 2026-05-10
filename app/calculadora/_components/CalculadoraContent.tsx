'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Input,
  Chip,
  GrainBadge,
} from '@/components/ui/phb'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  calcularPrecoLiquido,
  inputVazio,
  CLASSIFICACAO_PADRAO,
  type CalculoInput,
  type Grao,
} from '@/lib/calculo/preco-liquido'

interface Preset {
  grao: Grao
  precoBrutoSc?: number
  quantidadeSc?: number
  fromProposta: string | null
}

interface Props {
  comissaoPadrao: number
  preset: Preset
}

const GRAOS: { value: Grao; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
]

function buildInicial(comissaoPadrao: number, preset: Preset): CalculoInput {
  const i = inputVazio(preset.grao, true)
  i.comissao.valor.percentual = comissaoPadrao
  if (typeof preset.precoBrutoSc === 'number' && !Number.isNaN(preset.precoBrutoSc)) {
    i.precoBrutoSc = preset.precoBrutoSc
  }
  if (typeof preset.quantidadeSc === 'number' && !Number.isNaN(preset.quantidadeSc)) {
    i.quantidadeSc = preset.quantidadeSc
  }
  return i
}

interface DescontoCardProps {
  titulo: string
  ativo: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
  resumo?: string
}

function DescontoCard({ titulo, ativo, onToggle, children, resumo }: DescontoCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-body font-semibold text-fg-1">{titulo}</h3>
          {resumo ? <p className="text-small text-fg-3 truncate">{resumo}</p> : null}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-small text-fg-2">Aplicar</span>
        </label>
      </div>
      {ativo && children ? <div className="mt-4 space-y-3">{children}</div> : null}
    </Card>
  )
}

export function CalculadoraContent({ comissaoPadrao, preset }: Props) {
  const [input, setInput] = React.useState<CalculoInput>(() => buildInicial(comissaoPadrao, preset))

  const result = React.useMemo(() => calcularPrecoLiquido(input), [input])

  // Quando alterna PF/PJ, ajusta default do FUNRURAL
  React.useEffect(() => {
    setInput((prev) => ({
      ...prev,
      funrural: { ...prev.funrural, ativo: prev.pessoaFisica },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.pessoaFisica])

  // Quando muda grão, atualiza padrões de classificação se ela estiver inativa
  function setGrao(g: Grao) {
    setInput((prev) => {
      const padrao = CLASSIFICACAO_PADRAO[g]
      return {
        ...prev,
        grao: g,
        classificacao: prev.classificacao.ativo
          ? prev.classificacao
          : {
              ativo: false,
              valor: { umidade: padrao.umidadePadrao, impureza: padrao.impurezaPadrao },
            },
      }
    })
  }

  const padraoGrao = CLASSIFICACAO_PADRAO[input.grao]

  return (
    <div className="space-y-4">
      {preset.fromProposta ? (
        <div className="flex items-center gap-2">
          <Link href={`/propostas/${preset.fromProposta}`}>
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar para proposta
            </Button>
          </Link>
          <Chip variant="info">Pré-preenchido pela proposta</Chip>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* COLUNA INPUTS */}
        <div className="space-y-4">
          {/* Grão + bruto + quantidade */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Operação">Dados da operação</CardTitle>
            </CardHeader>
            <CardBody>
              <div>
                <label className="eyebrow mb-2 block">Grão</label>
                <div className="flex flex-wrap gap-2">
                  {GRAOS.map((g) => {
                    const ativo = input.grao === g.value
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGrao(g.value)}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-pill"
                      >
                        <GrainBadge
                          variant={g.value}
                          label={g.label}
                          className={ativo ? 'ring-2 ring-accent' : 'opacity-70'}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Preço bruto"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={input.precoBrutoSc || ''}
                  onChange={(e) =>
                    setInput((p) => ({ ...p, precoBrutoSc: parseFloat(e.target.value) || 0 }))
                  }
                  rightAddon="R$/sc"
                  placeholder="145,00"
                />
                <Input
                  label="Quantidade"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={input.quantidadeSc || ''}
                  onChange={(e) =>
                    setInput((p) => ({ ...p, quantidadeSc: parseFloat(e.target.value) || 0 }))
                  }
                  rightAddon="sc"
                  placeholder="1.000"
                />
              </div>

              <div>
                <label className="eyebrow mb-2 block">Tipo de pessoa</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInput((p) => ({ ...p, pessoaFisica: true }))}
                    className="focus:outline-none"
                  >
                    <Chip variant={input.pessoaFisica ? 'accent' : 'neutral'}>Pessoa Física</Chip>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput((p) => ({ ...p, pessoaFisica: false }))}
                    className="focus:outline-none"
                  >
                    <Chip variant={!input.pessoaFisica ? 'accent' : 'neutral'}>Pessoa Jurídica</Chip>
                  </button>
                </div>
                <p className="text-small text-fg-3 mt-1.5">
                  PF: FUNRURAL 1,3% auto-aplicado · PJ: avaliar regime (Simples isento)
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Frete */}
          <DescontoCard
            titulo="Frete"
            ativo={input.frete.ativo}
            onToggle={(v) => setInput((p) => ({ ...p, frete: { ...p.frete, ativo: v } }))}
            resumo={input.frete.ativo ? `R$ ${input.frete.valor.valorPorSc.toFixed(2)}/sc` : undefined}
          >
            <Input
              label="Valor por saca"
              type="number"
              step="0.01"
              min="0"
              value={input.frete.valor.valorPorSc || ''}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  frete: { ...p.frete, valor: { valorPorSc: parseFloat(e.target.value) || 0 } },
                }))
              }
              rightAddon="R$/sc"
              placeholder="5,00"
            />
          </DescontoCard>

          {/* Comissão */}
          <DescontoCard
            titulo="Comissão da corretora"
            ativo={input.comissao.ativo}
            onToggle={(v) => setInput((p) => ({ ...p, comissao: { ...p.comissao, ativo: v } }))}
            resumo={
              input.comissao.ativo
                ? `${input.comissao.valor.percentual}% sobre bruto · default ${comissaoPadrao}%`
                : undefined
            }
          >
            <Input
              label="Percentual"
              type="number"
              step="0.01"
              min="0"
              value={input.comissao.valor.percentual || ''}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  comissao: { ...p.comissao, valor: { percentual: parseFloat(e.target.value) || 0 } },
                }))
              }
              rightAddon="%"
              placeholder="1,5"
              helperText={`Padrão da empresa: ${comissaoPadrao}%`}
            />
          </DescontoCard>

          {/* FUNRURAL */}
          <DescontoCard
            titulo="FUNRURAL"
            ativo={input.funrural.ativo}
            onToggle={(v) => setInput((p) => ({ ...p, funrural: { ...p.funrural, ativo: v } }))}
            resumo="1,3% (1,2% INSS + 0,1% RAT) sobre bruto"
          >
            <p className="text-small text-fg-3">
              Aplicável a operações com produtor PF. PJ optante pelo Simples é isento; PJ regime
              normal recolhe na CDA.
            </p>
          </DescontoCard>

          {/* Classificação */}
          <DescontoCard
            titulo="Classificação (umidade + impureza)"
            ativo={input.classificacao.ativo}
            onToggle={(v) =>
              setInput((p) => ({ ...p, classificacao: { ...p.classificacao, ativo: v } }))
            }
            resumo={
              input.classificacao.ativo
                ? `Umidade ${input.classificacao.valor.umidade}% / Impureza ${input.classificacao.valor.impureza}% · padrão ${padraoGrao.umidadePadrao}/${padraoGrao.impurezaPadrao}`
                : `Padrão ${input.grao}: ${padraoGrao.umidadePadrao}% umidade · ${padraoGrao.impurezaPadrao}% impureza`
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={`Umidade real (padrão ${padraoGrao.umidadePadrao}%)`}
                type="number"
                step="0.1"
                min="0"
                value={input.classificacao.valor.umidade}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    classificacao: {
                      ...p.classificacao,
                      valor: {
                        ...p.classificacao.valor,
                        umidade: parseFloat(e.target.value) || 0,
                      },
                    },
                  }))
                }
                rightAddon="%"
              />
              <Input
                label={`Impureza real (padrão ${padraoGrao.impurezaPadrao}%)`}
                type="number"
                step="0.1"
                min="0"
                value={input.classificacao.valor.impureza}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    classificacao: {
                      ...p.classificacao,
                      valor: {
                        ...p.classificacao.valor,
                        impureza: parseFloat(e.target.value) || 0,
                      },
                    },
                  }))
                }
                rightAddon="%"
              />
            </div>
            <p className="text-small text-fg-3">
              Cada 1% acima do padrão = -1% no preço (linear). Abaixo do padrão gera ágio.
            </p>
          </DescontoCard>

          {/* Armazenagem */}
          <DescontoCard
            titulo="Armazenagem"
            ativo={input.armazenagem.ativo}
            onToggle={(v) =>
              setInput((p) => ({ ...p, armazenagem: { ...p.armazenagem, ativo: v } }))
            }
            resumo={
              input.armazenagem.ativo
                ? `R$ ${input.armazenagem.valor.valorPorScMes.toFixed(2)}/sc/mês × ${input.armazenagem.valor.meses} meses`
                : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tarifa"
                type="number"
                step="0.01"
                min="0"
                value={input.armazenagem.valor.valorPorScMes || ''}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    armazenagem: {
                      ...p.armazenagem,
                      valor: {
                        ...p.armazenagem.valor,
                        valorPorScMes: parseFloat(e.target.value) || 0,
                      },
                    },
                  }))
                }
                rightAddon="R$/sc/mês"
              />
              <Input
                label="Meses armazenados"
                type="number"
                step="1"
                min="0"
                value={input.armazenagem.valor.meses || ''}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    armazenagem: {
                      ...p.armazenagem,
                      valor: {
                        ...p.armazenagem.valor,
                        meses: parseFloat(e.target.value) || 0,
                      },
                    },
                  }))
                }
                rightAddon="meses"
              />
            </div>
          </DescontoCard>

          {/* ICMS */}
          <DescontoCard
            titulo="ICMS"
            ativo={input.icms.ativo}
            onToggle={(v) => setInput((p) => ({ ...p, icms: { ...p.icms, ativo: v } }))}
            resumo={
              input.icms.ativo ? `${input.icms.valor.percentual}% efetivo` : 'Diferimento (intra) = 0%'
            }
          >
            <Input
              label="Alíquota efetiva (após benefício fiscal)"
              type="number"
              step="0.01"
              min="0"
              value={input.icms.valor.percentual || ''}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  icms: { ...p.icms, valor: { percentual: parseFloat(e.target.value) || 0 } },
                }))
              }
              rightAddon="%"
              placeholder="1,8"
              helperText="Intraestadual normalmente 0% (diferimento). Interestadual: PR 1,8%, MT/MS 0% etc"
            />
          </DescontoCard>
        </div>

        {/* COLUNA RESULTADO (sticky) */}
        <div className="lg:sticky lg:top-4 self-start space-y-3">
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Resumo">Resultado</CardTitle>
            </CardHeader>
            <CardBody>
              <div>
                <p className="eyebrow">Bruto total</p>
                <p className="text-h2 font-semibold text-fg-1 t-num">
                  {formatCurrency(result.brutoTotal)}
                </p>
                <p className="text-small text-fg-3 t-num">
                  {formatCurrency(result.brutoPorSc)}/sc · {input.quantidadeSc.toLocaleString('pt-BR')} sc
                </p>
              </div>

              {result.linhas.length > 0 ? (
                <div className="border-t border-border-1 pt-3 space-y-2">
                  {result.linhas.map((linha, idx) => {
                    const isAgio = linha.valor > 0
                    const isDesconto = linha.valor < 0
                    const Icon = isAgio ? TrendingUp : TrendingDown
                    const cor = isAgio
                      ? 'var(--pos)'
                      : isDesconto
                        ? 'var(--neg)'
                        : 'var(--fg-2)'
                    return (
                      <div key={idx} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" style={{ color: cor }} />
                            <span className="text-small text-fg-1 font-medium">{linha.rotulo}</span>
                          </div>
                          {linha.detalhe ? (
                            <p className="text-micro text-fg-3 mt-0.5">{linha.detalhe}</p>
                          ) : null}
                        </div>
                        <span className="text-small font-semibold t-num shrink-0" style={{ color: cor }}>
                          {linha.valor >= 0 ? '+' : ''}
                          {formatCurrency(linha.valor)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-small text-fg-3 border-t border-border-1 pt-3">
                  Nenhum desconto aplicado.
                </p>
              )}

              <div className="border-t border-border-1 pt-3">
                <p className="eyebrow">Líquido ao produtor</p>
                <p className="text-h1 font-bold text-accent t-num">
                  {formatCurrency(result.liquidoTotal)}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-small text-fg-2 t-num">
                    {formatCurrency(result.liquidoPorSc)}/sc
                  </p>
                  <Chip
                    variant={
                      result.percentualDescontoEfetivo > 0
                        ? 'neg'
                        : result.percentualDescontoEfetivo < 0
                          ? 'pos'
                          : 'neutral'
                    }
                  >
                    {result.percentualDescontoEfetivo >= 0 ? '−' : '+'}
                    {Math.abs(result.percentualDescontoEfetivo).toFixed(2)}%
                  </Chip>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
