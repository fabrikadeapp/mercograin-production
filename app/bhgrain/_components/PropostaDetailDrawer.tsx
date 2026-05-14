'use client'

import { useState } from 'react'
import { Drawer } from './Drawer'
import { Skeleton, ErrorState, ScoreBadge, StatusBadge, Badge, fmtBRL, fmtPct, fmtRelativeMin, useJson } from './_shared'
import Link from 'next/link'
import { LogisticaPanel, EstoquePanel, QualidadePanel } from './PropostaPanels'
import { PropostaAcoes } from './PropostaAcoes'

interface PropostaDetalhe {
  resumo: {
    id: string
    numero: string
    status: string
    cliente: { id: string; nome: string }
    commodity: string
    quantidade: number | null
    unidade: string | null
    precoCotado: number | null
    valorTotal: number
    validadeEm: string
    previsaoCaixa: string | null
  }
  score: { score: number | null; label: string | null; fatoresPositivos: string[]; fatoresNegativos: string[] }
  margem: { precoProposto: number | null; custoEstimado: number | null; lucroBruto: number | null; margemPercent: number | null; margemMinima: number | null; abaixoDoMinimo: boolean }
  cotacao: { fonte: string | null; capturadaEm: string | null; validadeCotacao: string | null; minutosRestantes: number | null; vencida: boolean }
  mercado: { precoMercadoAtual: number | null; precoProposto: number | null; diferencaAbs: number | null; diferencaPercent: number | null; classificacao: string | null }
  acao: { acao: string; motivo: string; followUp: { precisa: boolean; mensagem: string; motivo: string } | null }
  timeline: { tipo: string; ocorridoEm: string; ator: string; observacao: string | null }[]
  auditoria: {
    criadoEm: string
    enviadoEm: string | null
    atualizadoEm: string
    cotacaoFonte: string | null
    cotacaoCapturadaEm: string | null
    margemAplicada: number | null
    solicitante: string | null
    aprovadores: { etapa: number; userId: string; decisao: string; em: string; motivo: string | null }[]
    statusAprovacao: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada' | 'expirada' | null
  }
  logistica: {
    origem: string | null
    destino: string | null
    localEntrega: string | null
    modalTransporte: string | null
    freteTipo: string | null
    freteCustoTotal: number | null
    freteCustoUnit: number | null
    prazoLogistico: string | null
    incoterm: string | null
    armazemOrigem: { id: string; nome: string } | null
    armazemDestino: { id: string; nome: string } | null
    pendenteInformacao: boolean
  }
  estoque: {
    lote: { id: string; numero: string; cultura: string; qtdAtualSc: number; armazem: { nome: string } } | null
    excedeDisponivel: boolean
    quantidadeProposta: number | null
  }
  qualidade: {
    umidadeMax: number | null
    impurezaMax: number | null
    ph: number | null
    proteinaMin: number | null
    ardidosMax: number | null
    avariadosMax: number | null
    padraoComercial: string | null
    observacoes: string | null
    preenchida: boolean
  }
}

const classificacaoLabel: Record<string, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  competitiva: { label: 'Competitiva', tone: 'success' },
  agressiva: { label: 'Agressiva', tone: 'warn' },
  conservadora: { label: 'Conservadora', tone: 'info' },
  margem_baixa: { label: 'Margem baixa', tone: 'warn' },
  risco_perda: { label: 'Risco de perda', tone: 'danger' },
}

export function PropostaDetailDrawer({
  propostaId,
  onClose,
}: {
  propostaId: string | null
  onClose: () => void
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, loading } = useJson<PropostaDetalhe>(
    propostaId ? `/api/bhgrain/propostas/${propostaId}` : null,
    [propostaId, reloadKey]
  )

  return (
    <Drawer
      open={propostaId !== null}
      onClose={onClose}
      title={data?.resumo.numero ? `Proposta ${data.resumo.numero}` : 'Detalhe da proposta'}
      subtitle={data?.resumo.cliente.nome}
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar detalhe" />
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Resumo */}
          <Section title="Resumo">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <KV label="Status" value={<StatusBadge status={data.resumo.status} />} />
              <KV
                label="Valor total"
                value={
                  <span className="tabular-nums">
                    R$ {fmtBRL(data.resumo.valorTotal, 2)}
                  </span>
                }
              />
              <KV label="Commodity" value={data.resumo.commodity} />
              <KV
                label="Quantidade"
                value={
                  data.resumo.quantidade != null ? (
                    <span className="tabular-nums">
                      {fmtBRL(data.resumo.quantidade, 2)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)' }}>
                        {data.resumo.unidade ?? 't'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                label="Preço cotado"
                value={
                  data.resumo.precoCotado != null ? (
                    <span className="tabular-nums">
                      R$ {fmtBRL(data.resumo.precoCotado, 2)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)' }}>
                        /{data.resumo.unidade ?? 'sc'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                label="Previsão de caixa"
                value={data.resumo.previsaoCaixa ? new Date(data.resumo.previsaoCaixa).toLocaleDateString('pt-BR') : '—'}
              />
            </div>
          </Section>

          {/* Score */}
          <Section title="Score de fechamento">
            <div className="flex items-center gap-2 mb-2">
              <ScoreBadge score={data.score.score} label={data.score.label} />
            </div>
            {data.score.fatoresPositivos.length > 0 && (
              <div className="mb-2">
                <div className="text-[11px] uppercase tracking-wider text-vg-fg-3 mb-1">Fatores positivos</div>
                <ul className="text-[12px] space-y-0.5">
                  {data.score.fatoresPositivos.map((f, i) => (
                    <li key={i} style={{ color: 'var(--vg-success, #10b981)' }}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.score.fatoresNegativos.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-vg-fg-3 mb-1">Fatores negativos</div>
                <ul className="text-[12px] space-y-0.5">
                  {data.score.fatoresNegativos.map((f, i) => (
                    <li key={i} style={{ color: 'var(--vg-destructive, #ef4444)' }}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Margem */}
          <Section title="Margem">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              {(() => {
                const unidade = data.resumo.unidade ?? 'sc'
                const PrecoUnit = ({ valor }: { valor: number | null }) =>
                  valor != null ? (
                    <span className="tabular-nums">
                      R$ {fmtBRL(valor, 2)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)' }}>
                        /{unidade}
                      </span>
                    </span>
                  ) : (
                    <>—</>
                  )
                return (
                  <>
                    <KV label="Preço proposto" value={<PrecoUnit valor={data.margem.precoProposto} />} />
                    <KV label="Custo estimado" value={<PrecoUnit valor={data.margem.custoEstimado} />} />
                    <KV label="Lucro bruto" value={<PrecoUnit valor={data.margem.lucroBruto} />} />
                    <KV label="Margem %" value={fmtPct(data.margem.margemPercent)} />
                  </>
                )
              })()}
            </div>
            {data.margem.abaixoDoMinimo && (
              <div className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--vg-destructive, #ef4444)' }}>
                ⚠ Margem abaixo do limite mínimo
              </div>
            )}
          </Section>

          {/* Cotação */}
          <Section title="Cotação usada">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <KV label="Fonte" value={data.cotacao.fonte ?? '—'} />
              <KV
                label="Capturada em"
                value={data.cotacao.capturadaEm ? new Date(data.cotacao.capturadaEm).toLocaleString('pt-BR') : '—'}
              />
              <KV
                label="Validade"
                value={
                  data.cotacao.vencida
                    ? <Badge tone="danger" label="Vencida" />
                    : data.cotacao.minutosRestantes != null
                      ? <Badge tone="success" label={`Válida · ${fmtRelativeMin(data.cotacao.minutosRestantes)}`} />
                      : '—'
                }
              />
            </div>
          </Section>

          {/* Comparativo mercado */}
          <Section title="Comparativo mercado vs proposta">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <KV
                label="Preço mercado"
                value={
                  data.mercado.precoMercadoAtual != null ? (
                    <span className="tabular-nums">
                      R$ {fmtBRL(data.mercado.precoMercadoAtual, 2)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)' }}>
                        /{data.resumo.unidade ?? 'sc'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                label="Preço proposto"
                value={
                  data.mercado.precoProposto != null ? (
                    <span className="tabular-nums">
                      R$ {fmtBRL(data.mercado.precoProposto, 2)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)' }}>
                        /{data.resumo.unidade ?? 'sc'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                label="Diferença"
                value={
                  data.mercado.diferencaPercent != null
                    ? <Badge tone={data.mercado.diferencaPercent >= 0 ? 'warn' : 'success'} label={fmtPct(data.mercado.diferencaPercent)} />
                    : '—'
                }
              />
              <KV
                label="Classificação"
                value={
                  data.mercado.classificacao
                    ? (() => {
                        const c = classificacaoLabel[data.mercado.classificacao]
                        return c ? <Badge tone={c.tone} label={c.label} /> : data.mercado.classificacao
                      })()
                    : '—'
                }
              />
            </div>
          </Section>

          {/* Próxima ação */}
          <Section title="Próxima melhor ação">
            <div className="text-[13px] font-semibold mb-1">{data.acao.acao}</div>
            <div className="text-[12px] text-vg-fg-2">{data.acao.motivo}</div>
            {data.acao.followUp?.precisa && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--vg-glass-pill-track)' }}>
                <div className="text-[11px] uppercase tracking-wider text-vg-fg-3 mb-1">Follow-up sugerido (requer aprovação humana)</div>
                <div className="text-[12px] italic mb-2">"{data.acao.followUp.mensagem}"</div>
                <div className="text-[11px] text-vg-fg-3">{data.acao.followUp.motivo}</div>
              </div>
            )}
          </Section>

          {/* Logística */}
          <LogisticaPanel propostaId={data.resumo.id} logistica={data.logistica} commodity={data.resumo.commodity} />

          {/* Estoque */}
          <EstoquePanel propostaId={data.resumo.id} estoque={data.estoque} commodity={data.resumo.commodity} />

          {/* Qualidade */}
          <QualidadePanel propostaId={data.resumo.id} qualidade={data.qualidade} />

          {/* Timeline */}
          <Section title="Timeline">
            {data.timeline.length === 0 ? (
              <div className="text-[12px] text-vg-fg-3">Sem eventos registrados.</div>
            ) : (
              <ol className="space-y-2 text-[12px]">
                {data.timeline.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-vg-fg-3 tabular-nums shrink-0 w-28">
                      {new Date(ev.ocorridoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{ev.tipo}</span>
                      <span className="text-vg-fg-3 ml-1">· {ev.ator}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Auditoria */}
          <Section title="Auditoria">
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <KV label="Criada em" value={new Date(data.auditoria.criadoEm).toLocaleString('pt-BR')} />
              <KV
                label="Enviada em"
                value={data.auditoria.enviadoEm ? new Date(data.auditoria.enviadoEm).toLocaleString('pt-BR') : '—'}
              />
              <KV label="Fonte do preço" value={data.auditoria.cotacaoFonte ?? '—'} />
              <KV
                label="Preço capturado"
                value={data.auditoria.cotacaoCapturadaEm ? new Date(data.auditoria.cotacaoCapturadaEm).toLocaleString('pt-BR') : '—'}
              />
              <KV
                label="Margem aplicada"
                value={data.auditoria.margemAplicada != null ? `${data.auditoria.margemAplicada.toFixed(2)}%` : '—'}
              />
              <KV label="Solicitante (aprovação)" value={data.auditoria.solicitante ?? '—'} />
            </div>

            {data.auditoria.statusAprovacao && (
              <div className="mt-3 p-2 rounded border" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                <div className="text-[11px] uppercase tracking-wider text-vg-fg-3 mb-1">
                  Aprovação · status: <Badge tone={data.auditoria.statusAprovacao === 'aprovada' ? 'success' : data.auditoria.statusAprovacao === 'rejeitada' ? 'danger' : 'warn'} label={data.auditoria.statusAprovacao} />
                </div>
                {data.auditoria.aprovadores.length === 0 ? (
                  <div className="text-[11px] text-vg-fg-3">Nenhuma decisão registrada ainda.</div>
                ) : (
                  <ol className="space-y-1 text-[11px]">
                    {data.auditoria.aprovadores.map((a, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-vg-fg-3 tabular-nums">Etapa {a.etapa}</span>
                        <Badge tone={a.decisao === 'aprovado' ? 'success' : 'danger'} label={a.decisao} />
                        <span className="text-vg-fg-3">·</span>
                        <span className="font-medium">{a.userId}</span>
                        <span className="text-vg-fg-3 tabular-nums">{new Date(a.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        {a.motivo && <span className="text-vg-fg-3">· {a.motivo}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </Section>

          {/* Ações: enviar/aprovar/rejeitar (chamam endpoints reais) */}
          <Section title="Ações">
            <PropostaAcoes
              propostaId={data.resumo.id}
              status={data.resumo.status}
              onChanged={() => setReloadKey((k) => k + 1)}
            />
          </Section>

          <div className="pt-3 border-t flex justify-between" style={{ borderColor: 'var(--vg-border-subtle)' }}>
            <Link
              href={`/propostas/${data.resumo.id}`}
              className="vg-btn vg-btn--secondary text-[12px] py-1.5 px-3"
            >
              Abrir página completa
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12px] uppercase tracking-wider text-vg-fg-3 mb-2">{title}</h3>
      {children}
    </section>
  )
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">{label}</div>
      <div className="text-[12px] font-medium tabular-nums">{value}</div>
    </div>
  )
}
