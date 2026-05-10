'use client'
import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'

const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || '5551999999999'
const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || 'vendas@profitsync.ia.br'

const WA_MESSAGE = encodeURIComponent(
  'Olá! Vi a BH Grain e gostaria de conversar sobre o plano Enterprise / demonstração.',
)

export function SalesContactFab() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!scrolled) return null

  return (
    <>
      {open ? (
        <div
          className="fixed bottom-24 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border-1 bg-bg-1 p-5 shadow-xl md:right-8"
          role="dialog"
          aria-label="Falar com vendas"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow mb-1 text-accent">Falar com vendas</p>
              <h3 className="text-h4 font-semibold text-fg-1">
                Demonstração ou plano Enterprise?
              </h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-pill p-1 text-fg-3 hover:bg-bg-2 hover:text-fg-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-small text-fg-2">
            Atendimento humano em até 1 dia útil. Tradings com 5+ usuários ou
            necessidades específicas (white-label, API, SLA).
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={`https://wa.me/${SALES_WHATSAPP}?text=${WA_MESSAGE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-pill bg-[#25D366] px-4 py-2.5 text-small font-semibold text-white hover:bg-[#128C7E]"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href={`mailto:${SALES_EMAIL}?subject=Interesse%20PHB%20Grain&body=${WA_MESSAGE}`}
              className="flex items-center justify-center rounded-pill border border-border-1 px-4 py-2.5 text-small font-medium text-fg-1 hover:bg-bg-2"
            >
              {SALES_EMAIL}
            </a>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-pill bg-accent text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl md:right-8"
        aria-label={open ? 'Fechar contato' : 'Falar com vendas'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  )
}
