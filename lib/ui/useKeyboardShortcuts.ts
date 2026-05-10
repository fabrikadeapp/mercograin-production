'use client'
import { useEffect } from 'react'

export interface Shortcut {
  /** Ex: 'b', 's', 'k', '/', 'ArrowUp' */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  /** label exibido no popup de ajuda */
  description: string
  handler: (e: KeyboardEvent) => void
  /** se true, ignora quando foco em input/textarea (default true) */
  ignoreInInputs?: boolean
}

function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Hook para atalhos de teclado declarativos. Cancela default só quando bate.
 * Ignora foco em inputs por padrão pra não bloquear digitação.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      for (const s of shortcuts) {
        const ignoreInputs = s.ignoreInInputs !== false
        if (ignoreInputs && isEditable(e.target)) continue
        const matchKey = e.key.toLowerCase() === s.key.toLowerCase()
        const matchCtrl = !!s.ctrl === (e.ctrlKey || e.metaKey)
        const matchShift = !!s.shift === e.shiftKey
        const matchAlt = !!s.alt === e.altKey
        if (matchKey && matchCtrl && matchShift && matchAlt) {
          e.preventDefault()
          s.handler(e)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, enabled])
}
