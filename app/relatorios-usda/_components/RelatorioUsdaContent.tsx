'use client'

import * as React from 'react'
import { toPng } from 'html-to-image'
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Chip,
  Select,
  EmptyState,
} from '@/components/ui/phb'
import {
  FileBarChart,
  Download,
  FileText,
  Link2,
  Check,
  Copy,
} from 'lucide-react'
import type {
  RelatorioUsda,
  Grao,
  Secao,
  Metrica,
  Seta,
  LinhaRelatorio,
  SecaoRelatorio,
} from '@/lib/usda/relatorio'

// ── Opções de configuração ──────────────────────────────────────────────────

const GRAOS: { valor: Grao; rotulo: string }[] = [
  { valor: 'soja', rotulo: 'Soja' },
  { valor: 'milho', rotulo: 'Milho' },
]

const SECOES: { valor: Secao; rotulo: string }[] = [
  { valor: 'mundo', rotulo: 'Mundo' },
  { valor: 'eua', rotulo: 'EUA' },
  { valor: 'brasil_argentina', rotulo: 'Brasil + Argentina' },
]

const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: 'estoqueFinal', rotulo: 'Estoques Finais' },
  { valor: 'producao', rotulo: 'Produção' },
  { valor: 'produtividade', rotulo: 'Produtividade' },
]

// Cor por grão (tokens válidos --grain-*).
const COR_GRAO: Record<Grao, string> = {
  soja: 'var(--grain-soja)',
  milho: 'var(--grain-milho)',
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  relatorioInicial: RelatorioUsda
  brandNome: string
  brandLogoUrl: string | null
}

type Origem = 'usda' | 'exemplo'

// ── Helpers de formatação ────────────────────────────────────────────────────

function fmtNum(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function fmtPct(p: number | null): string {
  if (p === null || Number.isNaN(p)) return '—'
  const sinal = p > 0 ? '+' : ''
  return `${sinal}${p.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function fmtDataHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Cor/símbolo da seta de variação.
function corSeta(seta: Seta): string {
  if (seta === 'up') return 'var(--success)'
  if (seta === 'down') return 'var(--danger)'
  return 'var(--fg-3)'
}

function simboloSeta(seta: Seta): string {
  if (seta === 'up') return '▲'
  if (seta === 'down') return '▼'
  return '–'
}

// Célula de variação com seta colorida + percentual.
function CelulaVariacao({ pct, seta }: { pct: number | null; seta: Seta }) {
  const cor = corSeta(seta)
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" style={{ color: cor }}>
      <span aria-hidden>{simboloSeta(seta)}</span>
      <span>{fmtPct(pct)}</span>
    </span>
  )
}

// ── Tabela densa de uma seção ────────────────────────────────────────────────

function TabelaSecao({ secao }: { secao: SecaoRelatorio }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: COR_GRAO[secao.grao] }}
          aria-hidden
        />
        <h4 className="text-body font-semibold text-fg-1">{secao.titulo}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-small border-collapse">
          <thead>
            <tr className="text-fg-3 text-left">
              <th className="py-2 pr-3 font-medium">Métrica</th>
              <th className="py-2 px-3 font-medium text-right">USDA atual</th>
              <th className="py-2 px-3 font-medium text-right">Mês anterior</th>
              <th className="py-2 px-3 font-medium text-right">Var. mensal</th>
              <th className="py-2 px-3 font-medium text-right">Safra passada</th>
              <th className="py-2 pl-3 font-medium text-right">Var. anual</th>
            </tr>
          </thead>
          <tbody>
            {secao.linhas.map((linha: LinhaRelatorio, i: number) => (
              <tr
                key={linha.rotulo + i}
                className="border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <td className="py-2 pr-3 text-fg-1 font-medium">{linha.rotulo}</td>
                <td className="py-2 px-3 text-right tabular-nums text-fg-1">
                  {fmtNum(linha.atual)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-fg-2">
                  {fmtNum(linha.anterior)}
                </td>
                <td className="py-2 px-3 text-right">
                  <CelulaVariacao pct={linha.variacaoMensal} seta={linha.setaMensal} />
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-fg-2">
                  {fmtNum(linha.safraPassada)}
                </td>
                <td className="py-2 pl-3 text-right">
                  <CelulaVariacao pct={linha.variacaoAnual} seta={linha.setaAnual} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export function RelatorioUsdaContent({
  relatorioInicial,
  brandNome,
  brandLogoUrl,
}: Props) {
  // Configuração (defaults: tudo selecionado, ano corrente).
  const [graos, setGraos] = React.useState<Grao[]>(['soja', 'milho'])
  const [secoes, setSecoes] = React.useState<Secao[]>([
    'mundo',
    'eua',
    'brasil_argentina',
  ])
  const [metricas, setMetricas] = React.useState<Metrica[]>([
    'estoqueFinal',
    'producao',
    'produtividade',
  ])
  const [ano, setAno] = React.useState<number>(new Date().getFullYear())

  // Relatório atual e estado.
  const [relatorio, setRelatorio] = React.useState<RelatorioUsda>(relatorioInicial)
  const [relatorioId, setRelatorioId] = React.useState<string | null>(null)
  const [origem, setOrigem] = React.useState<Origem>('exemplo')
  const [gerando, setGerando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  // Exportações.
  const [baixandoPng, setBaixandoPng] = React.useState(false)
  const [linkPublico, setLinkPublico] = React.useState<string | null>(null)
  const [gerandoLink, setGerandoLink] = React.useState(false)
  const [copiado, setCopiado] = React.useState(false)

  const previewRef = React.useRef<HTMLDivElement>(null)

  // Toggles de chips.
  function toggle<T>(lista: T[], valor: T, set: (v: T[]) => void) {
    if (lista.includes(valor)) {
      // Mantém ao menos um selecionado.
      if (lista.length === 1) return
      set(lista.filter((x) => x !== valor))
    } else {
      set([...lista, valor])
    }
  }

  const anos = React.useMemo(() => {
    const atual = new Date().getFullYear()
    const lista: number[] = []
    for (let a = atual + 1; a >= atual - 4; a--) lista.push(a)
    return lista
  }, [])

  // POST /api/relatorios-usda → gera + persiste.
  async function gerarRelatorio() {
    setGerando(true)
    setErro(null)
    setLinkPublico(null)
    setCopiado(false)
    try {
      const res = await fetch('/api/relatorios-usda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graos, secoes, metricas, ano }),
      })
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Recurso não disponível no seu plano.')
        }
        if (res.status === 401) {
          throw new Error('Sessão expirada. Faça login novamente.')
        }
        throw new Error('Falha ao gerar o relatório. Tente novamente.')
      }
      const data = (await res.json()) as {
        id: string
        relatorio: RelatorioUsda
        origem: Origem
      }
      setRelatorio(data.relatorio)
      setRelatorioId(data.id)
      setOrigem(data.origem)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setGerando(false)
    }
  }

  // Baixar PNG do preview (html-to-image).
  async function baixarPng() {
    if (!previewRef.current) return
    setBaixandoPng(true)
    setErro(null)
    try {
      // Fundo sólido para o PNG (evita transparência sobre o tema).
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-1') || '#0b0b0c'
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: bg.trim() || '#0b0b0c',
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `relatorio-usda-${ano}.png`
      a.click()
    } catch {
      setErro('Não foi possível gerar o PNG.')
    } finally {
      setBaixandoPng(false)
    }
  }

  // Baixar PDF (abre a rota GET; só disponível após gerar/persistir).
  function baixarPdf() {
    if (!relatorioId) return
    window.open(`/api/relatorios-usda/${relatorioId}/pdf`, '_blank')
  }

  // Gerar link público (POST share).
  async function gerarLink() {
    if (!relatorioId) return
    setGerandoLink(true)
    setErro(null)
    setCopiado(false)
    try {
      const res = await fetch(`/api/relatorios-usda/${relatorioId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Falha ao gerar o link público.')
      const data = (await res.json()) as { url: string }
      const url =
        typeof window !== 'undefined'
          ? new URL(data.url, window.location.origin).toString()
          : data.url
      setLinkPublico(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar link.')
    } finally {
      setGerandoLink(false)
    }
  }

  async function copiarLink() {
    if (!linkPublico) return
    try {
      await navigator.clipboard.writeText(linkPublico)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Não foi possível copiar o link.')
    }
  }

  const podeExportarServidor = !!relatorioId

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      {/* ── Painel de configuração ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Configuração">Parâmetros</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Grãos */}
            <div className="space-y-2">
              <p className="eyebrow">Grãos</p>
              <div className="flex flex-wrap gap-2">
                {GRAOS.map((g) => {
                  const on = graos.includes(g.valor)
                  return (
                    <button
                      key={g.valor}
                      type="button"
                      onClick={() => toggle(graos, g.valor, setGraos)}
                      aria-pressed={on}
                    >
                      <Chip
                        variant={on ? 'accent' : 'neutral'}
                        leftIcon={
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: COR_GRAO[g.valor] }}
                            aria-hidden
                          />
                        }
                      >
                        {g.rotulo}
                      </Chip>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Seções */}
            <div className="space-y-2">
              <p className="eyebrow">Seções</p>
              <div className="flex flex-wrap gap-2">
                {SECOES.map((s) => {
                  const on = secoes.includes(s.valor)
                  return (
                    <button
                      key={s.valor}
                      type="button"
                      onClick={() => toggle(secoes, s.valor, setSecoes)}
                      aria-pressed={on}
                    >
                      <Chip variant={on ? 'accent' : 'neutral'}>{s.rotulo}</Chip>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Métricas */}
            <div className="space-y-2">
              <p className="eyebrow">Métricas</p>
              <div className="flex flex-wrap gap-2">
                {METRICAS.map((m) => {
                  const on = metricas.includes(m.valor)
                  return (
                    <button
                      key={m.valor}
                      type="button"
                      onClick={() => toggle(metricas, m.valor, setMetricas)}
                      aria-pressed={on}
                    >
                      <Chip variant={on ? 'accent' : 'neutral'}>{m.rotulo}</Chip>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ano */}
            <div className="space-y-2">
              <p className="eyebrow">Ano (safra)</p>
              <Select
                value={String(ano)}
                onChange={(e) => setAno(Number(e.target.value))}
                options={anos.map((a) => ({
                  value: String(a),
                  label: `${a} (safra ${String((a - 1) % 100).padStart(2, '0')}/${String(
                    a % 100,
                  ).padStart(2, '0')})`,
                }))}
              />
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={gerando}
              onClick={gerarRelatorio}
              leftIcon={<FileBarChart className="h-4 w-4" />}
            >
              {gerando ? 'Gerando…' : 'Gerar relatório'}
            </Button>

            {erro ? (
              <p className="text-small text-danger" role="alert">
                {erro}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {/* Exportações */}
        <Card>
          <CardHeader>
            <CardTitle eyebrow="Exportar">Saídas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Button
              variant="secondary"
              fullWidth
              loading={baixandoPng}
              onClick={baixarPng}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Baixar PNG
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={baixarPdf}
              disabled={!podeExportarServidor}
              leftIcon={<FileText className="h-4 w-4" />}
            >
              Baixar PDF
            </Button>

            <Button
              variant="secondary"
              fullWidth
              loading={gerandoLink}
              onClick={gerarLink}
              disabled={!podeExportarServidor}
              leftIcon={<Link2 className="h-4 w-4" />}
            >
              Gerar link público
            </Button>

            {!podeExportarServidor ? (
              <p className="text-small text-fg-3">
                Gere o relatório para habilitar PDF e link público.
              </p>
            ) : null}

            {linkPublico ? (
              <div
                className="rounded-md p-3 space-y-2"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
              >
                <p className="eyebrow">Link público</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={linkPublico}
                    className="flex-1 min-w-0 bg-transparent text-small text-fg-2 outline-none truncate"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copiarLink}
                    leftIcon={
                      copiado ? (
                        <Check className="h-4 w-4" style={{ color: 'var(--success)' }} />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )
                    }
                  >
                    {copiado ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* ── Preview do relatório ── */}
      <Card>
        <CardHeader>
          <CardTitle eyebrow="Preview">Relatório renderizado</CardTitle>
          <div className="flex items-center gap-2">
            <Chip variant={origem === 'usda' ? 'pos' : 'warn'}>
              {origem === 'usda' ? 'USDA ao vivo' : 'Dados de exemplo'}
            </Chip>
          </div>
        </CardHeader>
        <CardBody>
          {/* Área capturada para PNG */}
          <div
            ref={previewRef}
            id="relatorio-usda-preview"
            className="rounded-lg p-6"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
          >
            {/* Cabeçalho com logo + título + mês */}
            <div
              className="flex items-center justify-between gap-4 pb-4 mb-5"
              style={{ borderBottom: '2px solid var(--accent)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogoUrl}
                    alt={brandNome}
                    className="h-10 w-auto object-contain"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--accent-ink, #0b0b0c)' }}
                  >
                    {brandNome.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="eyebrow">{brandNome}</p>
                  <h3 className="text-h3 font-semibold text-fg-1 truncate">
                    {relatorio.titulo || 'Relatório USDA'}
                  </h3>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="eyebrow">Referência</p>
                <p className="text-body font-semibold text-fg-1">
                  {relatorio.mesReferencia || '—'}
                </p>
              </div>
            </div>

            {/* Seções */}
            {relatorio.secoes.length === 0 ? (
              <EmptyState
                icon={FileBarChart}
                title="Sem dados para exibir"
                description="Ajuste a configuração e gere o relatório."
              />
            ) : (
              relatorio.secoes.map((secao, i) => (
                <TabelaSecao key={secao.titulo + i} secao={secao} />
              ))
            )}

            {/* Rodapé do preview */}
            <div
              className="flex items-center justify-between pt-4 mt-2 text-small text-fg-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <span>Fonte: {relatorio.fonte || 'USDA'} · Valores em milhões de toneladas</span>
              <span>Gerado em {fmtDataHora(relatorio.geradoEm)}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
