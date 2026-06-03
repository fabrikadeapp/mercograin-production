'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic,
  MicOff,
  Plus,
  Send,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageCircle,
  X,
} from 'lucide-react'
import { Card, Button } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { parseComando, type ParsedComando } from '@/lib/propostas/parse-comando'
import { ClienteQuickCreateModal } from '@/components/clientes/ClienteQuickCreateModal'
import type { ClienteCriado } from '@/components/clientes/ClienteForm'
import { KG_POR_SC } from '@/lib/cotacoes/unidades'
import { formatCurrency } from '@/lib/utils/formatters'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'

interface Cliente {
  id: string
  nome: string
}

export interface PropostaCommandBarProps {
  clientes: Cliente[]
  usdbrl: number | null
  marginsMap: Record<string, number>
  /** Recarrega clientes após criação inline. */
  onClienteCriado: (cliente: ClienteCriado) => void
}

/**
 * Score simples (0..1) de match entre nome digitado e nome do cliente.
 * Substring → 1.0 · prefixo de cada palavra → 0.7 · resto → Levenshtein normalizado.
 */
function scoreCliente(nomeDigitado: string, nomeCliente: string): number {
  const a = nomeDigitado.toLowerCase().trim()
  const b = nomeCliente.toLowerCase().trim()
  if (!a || !b) return 0
  if (b.includes(a)) return 1
  if (a.includes(b)) return 0.9
  const palavrasA = a.split(/\s+/).filter(Boolean)
  const palavrasB = b.split(/\s+/).filter(Boolean)
  const matchPrefixo = palavrasA.every((p) => palavrasB.some((q) => q.startsWith(p)))
  if (matchPrefixo && palavrasA.length >= 1) return 0.7
  // fallback: contagem de palavras em comum
  const inter = palavrasA.filter((p) => palavrasB.some((q) => q.includes(p) || p.includes(q)))
  return inter.length / Math.max(palavrasA.length, 1) * 0.5
}

export function PropostaCommandBar({
  clientes,
  usdbrl,
  marginsMap,
  onClienteCriado,
}: PropostaCommandBarProps) {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [parsed, setParsed] = useState<ParsedComando | null>(null)
  const [criando, setCriando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [modoTranscricao, setModoTranscricao] = useState(false)
  const [propostaCriada, setPropostaCriada] = useState<{
    id: string
    numero: string
    clienteId: string
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const speech = useSpeechRecognition({
    onTranscript: (full) => setTexto(full),
  })

  // Auto-foco ao montar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Parse debounced
  useEffect(() => {
    if (!texto.trim()) {
      setParsed(null)
      return
    }
    const id = setTimeout(() => {
      setParsed(parseComando(texto, { usdbrl, now: new Date() }))
    }, 150)
    return () => clearTimeout(id)
  }, [texto, usdbrl])

  // Match de cliente
  const clienteMatch = useMemo(() => {
    if (!parsed?.clienteNome) return null
    const candidatos = clientes
      .map((c) => ({ cliente: c, score: scoreCliente(parsed.clienteNome!, c.nome) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return candidatos[0] ?? null
  }, [parsed?.clienteNome, clientes])

  const clienteEncontrado = clienteMatch && clienteMatch.score >= 0.6 ? clienteMatch.cliente : null
  const podeCriar =
    !!parsed?.grao &&
    !!parsed?.quantidadeTon &&
    parsed.quantidadeTon > 0 &&
    !!parsed?.precoBrlTon &&
    parsed.precoBrlTon > 0 &&
    !!parsed?.validadeEm &&
    !!clienteEncontrado

  // Cálculo de subtotal e margem
  const subtotal = parsed?.quantidadeTon && parsed?.precoBrlTon
    ? parsed.quantidadeTon * parsed.precoBrlTon
    : 0

  const margemProjetada = useMemo(() => {
    if (!parsed?.grao || !parsed?.precoBrlTon || !parsed?.quantidadeTon) return 0
    const m = marginsMap[parsed.grao]
    if (m == null || m <= 0) return 0
    return parsed.precoBrlTon * (m / 100) * parsed.quantidadeTon
  }, [parsed?.grao, parsed?.precoBrlTon, parsed?.quantidadeTon, marginsMap])

  // Atalhos
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = document.activeElement === inputRef.current
      const isTextarea = document.activeElement === textareaRef.current
      const focado = isInput || isTextarea

      // Enter (sem shift) no input → criar
      if (e.key === 'Enter' && !e.shiftKey && isInput) {
        e.preventDefault()
        void handleSubmit(false)
      }
      // Shift+Enter no input → criar + enviar
      if (e.key === 'Enter' && e.shiftKey && isInput) {
        e.preventDefault()
        void handleSubmit(true)
      }
      // Cmd/Ctrl+Enter em qualquer um → criar
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && focado) {
        e.preventDefault()
        void handleSubmit(false)
      }
      // Tab quando cliente não existe → abre modal
      if (e.key === 'Tab' && focado && parsed?.clienteNome && !clienteEncontrado) {
        e.preventDefault()
        setModalAberto(true)
      }
      // Esc → limpa
      if (e.key === 'Escape' && focado) {
        setTexto('')
        setParsed(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, clienteEncontrado, podeCriar])

  const handleSubmit = async (enviar: boolean) => {
    if (!podeCriar || !parsed || !clienteEncontrado) {
      showError('Preencha cliente, grão, quantidade, preço e validade')
      return
    }
    setCriando(true)
    try {
      const payload = {
        clienteId: clienteEncontrado.id,
        tipo: parsed.tipo ?? 'venda',
        validadeEm: parsed.validadeEm!.toISOString().slice(0, 10),
        valor: subtotal,
        canalAutorizacao: 'telefone',
        origem: parsed.local,
        graos: [
          {
            grao: parsed.grao,
            quantidade: parsed.quantidadeTon,
            preco: parsed.precoBrlTon,
            subtotal,
          },
        ],
      }
      const r = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao criar proposta')
      }
      const proposta = await r.json()
      success(`Proposta ${proposta.numero ?? ''} criada`)

      if (enviar && proposta.id) {
        const r2 = await fetch(`/api/bhgrain/propostas/${proposta.id}/enviar`, { method: 'POST' })
        if (r2.ok) success('Proposta enviada')
        else showError('Proposta criada mas falhou envio')
      }

      // Em vez de redirecionar, mostra painel pós-criação com ações
      setPropostaCriada({
        id: proposta.id,
        numero: proposta.numero,
        clienteId: proposta.clienteId,
      })
      setTexto('')
      setParsed(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setCriando(false)
    }
  }

  const toggleMic = () => {
    if (!speech.supported) return
    if (speech.listening) {
      speech.stop()
    } else {
      speech.reset()
      setTexto('')
      speech.start()
    }
  }

  // Painel pós-criação — depois de criar, mostra ações WhatsApp/PDF/concluir
  if (propostaCriada) {
    return (
      <PainelPosCriacao
        proposta={propostaCriada}
        onConcluir={() => router.push('/propostas')}
        onNovaProposta={() => {
          setPropostaCriada(null)
          inputRef.current?.focus()
        }}
      />
    )
  }

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-accent" />
            <p className="eyebrow">
              {modoTranscricao ? 'Modo transcrição (cole a ligação)' : 'Criar proposta por comando'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModoTranscricao((v) => !v)
              setTimeout(() => {
                if (!modoTranscricao) textareaRef.current?.focus()
                else inputRef.current?.focus()
              }, 50)
            }}
            className="text-[11px] underline text-fg-3 hover:text-fg-1"
          >
            {modoTranscricao ? '← voltar para comando' : 'colar transcrição →'}
          </button>
        </div>

        {!modoTranscricao ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Fazenda São João 1000sc soja 130/sc 30d Sorriso"
              className="w-full px-4 py-3 pr-24 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3"
              style={{ fontFamily: 'var(--f-mono)', fontSize: 15 }}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {speech.supported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  title={speech.listening ? 'Parar de ouvir' : 'Ditar (PT-BR)'}
                  className={speech.listening ? 'chip active' : 'chip'}
                  style={{ padding: '6px 8px' }}
                >
                  {speech.listening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={
                'Cole aqui a transcrição da ligação ou WhatsApp.\n\n' +
                'Ex:\n"Bom dia João, da Fazenda São João aqui. Queria fechar mil sacas de soja a R$ 130 a saca, ' +
                'entrega em 30 dias, em Sorriso."'
              }
              rows={6}
              className="w-full px-4 py-3 pr-24 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
              style={{ fontFamily: 'var(--f-sans)', fontSize: 14 }}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-2 top-2 flex items-center gap-1">
              {speech.supported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  title={speech.listening ? 'Parar de ouvir' : 'Ditar (PT-BR)'}
                  className={speech.listening ? 'chip active' : 'chip'}
                  style={{ padding: '6px 8px' }}
                >
                  {speech.listening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
            {speech.listening && (
              <p
                className="text-[11px] mt-1 flex items-center gap-1.5"
                style={{ color: 'var(--accent)' }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Ouvindo… fale em PT-BR. O texto aparece em tempo real.
              </p>
            )}
            {speech.error && (
              <p className="text-[11px] mt-1 text-warn">Erro voz: {speech.error}</p>
            )}
          </div>
        )}

        {parsed && (
          <div
            className="rounded-md p-3 space-y-2 text-small"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
          >
            {/* Cliente */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-fg-3">Cliente</span>
              <span className="text-fg-1 font-medium tabular-nums">
                {parsed.clienteNome ? (
                  clienteEncontrado ? (
                    <>
                      <CheckCircle2 className="inline h-3.5 w-3.5 text-pos mr-1" />
                      {clienteEncontrado.nome}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="inline h-3.5 w-3.5 text-warn mr-1" />
                      {parsed.clienteNome} <span className="text-fg-3">— não encontrado</span>
                      <button
                        type="button"
                        onClick={() => setModalAberto(true)}
                        className="ml-2 underline text-accent text-[12px]"
                      >
                        [Tab] criar
                      </button>
                    </>
                  )
                ) : (
                  <span className="text-fg-3">—</span>
                )}
              </span>
            </div>

            {/* Grão + qtd */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-fg-3">Grão · quantidade</span>
              <span className="text-fg-1 font-medium tabular-nums">
                {parsed.grao ? (
                  <>
                    {parsed.grao} ·{' '}
                    {parsed.quantidadeTon
                      ? `${parsed.quantidadeTon.toFixed(2)} t`
                      : '—'}
                    {parsed.quantidadeTon && parsed.grao && (
                      <span className="text-fg-3 ml-2">
                        (
                        {((parsed.quantidadeTon * 1000) / KG_POR_SC[parsed.grao]).toFixed(0)} sc60
                        )
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-3">—</span>
                )}
              </span>
            </div>

            {/* Preço */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-fg-3">Preço</span>
              <span className="text-fg-1 font-medium tabular-nums">
                {parsed.precoBrlTon ? (
                  <>
                    R$ {parsed.precoBrlTon.toFixed(2)}/t
                    {parsed.grao && (
                      <span className="text-fg-3 ml-2">
                        (R$ {((parsed.precoBrlTon * KG_POR_SC[parsed.grao]) / 1000).toFixed(2)}/sc)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-3">—</span>
                )}
              </span>
            </div>

            {/* Validade */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-fg-3">Validade</span>
              <span className="text-fg-1 font-medium tabular-nums">
                {parsed.validadeEm
                  ? parsed.validadeEm.toLocaleDateString('pt-BR')
                  : <span className="text-fg-3">—</span>}
                {parsed.validadeRelativa && (
                  <span className="text-fg-3 ml-2">(+{parsed.validadeRelativa}d)</span>
                )}
              </span>
            </div>

            {/* Local */}
            {parsed.local && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-fg-3">Local</span>
                <span className="text-fg-1 font-medium">{parsed.local}</span>
              </div>
            )}

            {/* Tipo */}
            {parsed.tipo && parsed.tipo !== 'venda' && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-fg-3">Tipo</span>
                <span className="text-fg-1 font-medium uppercase">{parsed.tipo}</span>
              </div>
            )}

            {/* Subtotal + margem */}
            {subtotal > 0 && (
              <div
                className="pt-2 mt-1 flex items-center justify-between gap-2 flex-wrap"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="text-fg-3">Subtotal</span>
                <span className="text-accent font-semibold tabular-nums">
                  {formatCurrency(subtotal)}
                </span>
              </div>
            )}
            {margemProjetada > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-fg-3">Margem projetada</span>
                <span className="text-pos font-semibold tabular-nums">
                  {formatCurrency(margemProjetada)}
                </span>
              </div>
            )}

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="space-y-1 pt-1">
                {parsed.warnings.map((w, i) => (
                  <div key={i} className="text-warn text-[12px] flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-fg-3">
          <span>
            <kbd className="kbd">Enter</kbd> criar ·{' '}
            <kbd className="kbd">⇧Enter</kbd> criar + enviar ·{' '}
            <kbd className="kbd">Tab</kbd> criar cliente ·{' '}
            <kbd className="kbd">Esc</kbd> limpar
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!podeCriar}
              loading={criando}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => handleSubmit(false)}
            >
              Criar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!podeCriar}
              loading={criando}
              leftIcon={<Send className="h-3.5 w-3.5" />}
              onClick={() => handleSubmit(true)}
            >
              Criar e enviar
            </Button>
          </div>
        </div>
      </Card>

      <ClienteQuickCreateModal
        open={modalAberto}
        onClose={() => {
          setModalAberto(false)
          inputRef.current?.focus()
        }}
        initialNome={parsed?.clienteNome}
        onCreated={(cliente) => {
          onClienteCriado(cliente)
          success(`${cliente.nome} criado`)
          inputRef.current?.focus()
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────
// Painel pós-criação — mostrado depois de criar a proposta.
// Oferece: WhatsApp 1-clique, copiar link público, baixar PDF, ir para a lista.
// ─────────────────────────────────────────────
interface PainelPosCriacaoProps {
  proposta: { id: string; numero: string; clienteId: string }
  onConcluir: () => void
  onNovaProposta: () => void
}

function PainelPosCriacao({ proposta, onConcluir, onNovaProposta }: PainelPosCriacaoProps) {
  const { success, error: showError, info } = useToast()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [carregandoShare, setCarregandoShare] = useState(false)
  const [enviandoWhats, setEnviandoWhats] = useState(false)

  const obterShareUrl = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl
    setCarregandoShare(true)
    try {
      const r = await fetch(`/api/propostas/${proposta.id}/share`, { method: 'POST' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        showError(j.error || 'Erro ao gerar link')
        return null
      }
      const j = await r.json()
      setShareUrl(j.url)
      return j.url as string
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao gerar link')
      return null
    } finally {
      setCarregandoShare(false)
    }
  }

  const copiarLink = async () => {
    const url = await obterShareUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      success('Link copiado')
    } catch {
      info(url) // fallback: mostra no toast
    }
  }

  const enviarWhatsServer = async () => {
    setEnviandoWhats(true)
    try {
      // Primeiro: garante share link no histórico (e log)
      const url = await obterShareUrl()
      const r = await fetch(`/api/propostas/${proposta.id}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        success(j.message || 'WhatsApp enviado')
      } else if (r.status === 400 && j.error === 'Número WhatsApp não fornecido') {
        // Fallback: abre wa.me sem destino — operador escolhe contato
        if (url) {
          window.open(`https://wa.me/?text=${encodeURIComponent(mensagemWhats(proposta.numero, url))}`, '_blank')
          info('Cliente sem WhatsApp salvo — abri o app pra você escolher')
        } else {
          showError('Cliente sem WhatsApp salvo')
        }
      } else {
        showError(j.message || j.error || 'Falha no envio WhatsApp')
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setEnviandoWhats(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="rounded-full p-2"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="eyebrow">Proposta criada</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            {proposta.numero}
          </h3>
          <p className="text-fg-3 text-small">
            Escolha o próximo passo. Os atalhos abaixo funcionam.
          </p>
        </div>
        <button
          type="button"
          onClick={onNovaProposta}
          title="Nova proposta"
          className="chip"
          style={{ padding: '6px 8px' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Button
          type="button"
          variant="primary"
          leftIcon={<MessageCircle className="h-4 w-4" />}
          loading={enviandoWhats}
          onClick={enviarWhatsServer}
        >
          Enviar por WhatsApp
        </Button>

        <Button
          type="button"
          variant="secondary"
          leftIcon={<FileText className="h-4 w-4" />}
          loading={carregandoShare}
          onClick={copiarLink}
        >
          {shareUrl ? 'Copiar link público' : 'Gerar link público'}
        </Button>

        <a
          href={`/api/propostas/${proposta.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            type="button"
            variant="ghost"
            leftIcon={<FileText className="h-4 w-4" />}
            className="w-full"
          >
            Baixar PDF privado
          </Button>
        </a>

        <Button
          type="button"
          variant="ghost"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={onNovaProposta}
        >
          Nova proposta
        </Button>
      </div>

      {shareUrl && (
        <div
          className="rounded-md p-2 text-[12px] break-all"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', fontFamily: 'var(--f-mono)' }}
        >
          {shareUrl}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border-1">
        <Button type="button" variant="ghost" size="sm" onClick={onConcluir}>
          Ir para lista de propostas
        </Button>
      </div>
    </Card>
  )
}

function mensagemWhats(numero: string, link: string): string {
  return `Olá! Segue a proposta ${numero}. Acesse o PDF: ${link}`
}
