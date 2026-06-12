'use client'

/**
 * BotaoAtualizar — botão "Atualizar agora" UNIVERSAL para as páginas de intel.
 *
 * Faz POST /api/intel/forcar (força o refresh de TODAS as fontes da
 * inteligência respeitando a reserva de 95%), mostra estado de loading (ícone
 * RefreshCw girando), exibe um chip discreto com a hora da última atualização
 * e, se alguma fonte estava no limite de taxa, um aviso sutil de que ela serviu
 * cache.
 *
 * ─── COMO USAR ───────────────────────────────────────────────────────────────
 * Importe e coloque no header (PageHeader / barra de ações) de cada página de
 * intel. Passe `onAtualizado` para a página recarregar seus dados após o
 * refresh (re-fetch / router.refresh):
 *
 *   'use client'
 *   import { BotaoAtualizar } from '@/app/intel/_components/BotaoAtualizar'
 *   import { useRouter } from 'next/navigation'
 *
 *   export function HeaderIntel() {
 *     const router = useRouter()
 *     return (
 *       <BotaoAtualizar onAtualizado={() => router.refresh()} />
 *     )
 *   }
 *
 * Em páginas que buscam via fetch no client, passe seu próprio recarregador:
 *
 *   <BotaoAtualizar onAtualizado={recarregarDados} />
 *
 * O componente é autocontido: gerencia seu próprio loading/estado e nunca
 * lança — em erro de rede apenas não atualiza o chip e libera o botão.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/phb'
import { Chip } from '@/components/ui/phb'

export interface BotaoAtualizarProps {
  /** Chamado após uma atualização bem-sucedida — a página recarrega seus dados. */
  onAtualizado?: () => void
}

interface RespostaForcar {
  ok?: boolean
  atualizadoEm?: string
  fontesAtualizadas?: string[]
  fontesNoLimite?: string[]
  erro?: string
}

/** Formata "há Xs / há Xmin / às HH:mm" a partir da última atualização. */
function rotuloTempo(ultima: Date | null, agora: Date): string {
  if (!ultima) return ''
  const segs = Math.max(0, Math.floor((agora.getTime() - ultima.getTime()) / 1000))
  if (segs < 60) return `Atualizado há ${segs}s`
  if (segs < 3600) return `Atualizado há ${Math.floor(segs / 60)}min`
  const hh = String(ultima.getHours()).padStart(2, '0')
  const mm = String(ultima.getMinutes()).padStart(2, '0')
  return `Atualizado às ${hh}:${mm}`
}

export function BotaoAtualizar({ onAtualizado }: BotaoAtualizarProps) {
  const [carregando, setCarregando] = React.useState(false)
  const [ultima, setUltima] = React.useState<Date | null>(null)
  const [serviuCache, setServiuCache] = React.useState(false)
  // "Tick" para reavaliar o rótulo "há Xs" a cada segundo enquanto há valor.
  const [, setTick] = React.useState(0)

  React.useEffect(() => {
    if (!ultima) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [ultima])

  const atualizar = React.useCallback(async () => {
    if (carregando) return
    setCarregando(true)
    try {
      const resp = await fetch('/api/intel/forcar', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
      })
      const dados = (await resp.json()) as RespostaForcar
      // Endpoint sempre responde 200 (best-effort). Usa atualizadoEm da resposta
      // quando presente, senão o relógio local.
      const quando = dados.atualizadoEm ? new Date(dados.atualizadoEm) : new Date()
      setUltima(Number.isNaN(quando.getTime()) ? new Date() : quando)
      setServiuCache(
        Array.isArray(dados.fontesNoLimite) && dados.fontesNoLimite.length > 0,
      )
      onAtualizado?.()
    } catch (err) {
      // Best-effort: não trava a UI; apenas loga e mantém o estado anterior.
      console.warn('[BotaoAtualizar] falha ao forçar atualização:', err)
    } finally {
      setCarregando(false)
    }
  }, [carregando, onAtualizado])

  const rotulo = rotuloTempo(ultima, new Date())

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={atualizar}
        loading={carregando}
        leftIcon={
          carregando ? undefined : <RefreshCw className="h-4 w-4" aria-hidden="true" />
        }
        aria-label="Atualizar agora"
      >
        {carregando ? 'Atualizando…' : 'Atualizar agora'}
      </Button>

      {rotulo && (
        <Chip variant="neutral" className="text-small">
          {rotulo}
        </Chip>
      )}

      {serviuCache && (
        <Chip
          variant="warn"
          className="text-small"
          leftIcon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
          title="Algumas fontes serviram cache por estarem no limite de taxa."
        >
          algumas fontes serviram cache (limite de taxa)
        </Chip>
      )}
    </div>
  )
}

export default BotaoAtualizar
