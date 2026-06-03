'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tipagem mínima da Web Speech API — TS DOM lib não cobre em todas as versões.
 */
interface SpeechRecognitionResult {
  isFinal: boolean
  0: { transcript: string; confidence: number }
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResult> & { length: number }
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UseSpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  /** Chamado a cada resultado (final + interim concatenados). */
  onTranscript?: (full: string, isFinal: boolean) => void
}

export interface UseSpeechRecognitionResult {
  /** true se o browser oferece Web Speech API. */
  supported: boolean
  /** true enquanto está escutando. */
  listening: boolean
  /** Transcrição acumulada (finais + interim atual). */
  transcript: string
  /** Última mensagem de erro, se houver. */
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * Hook para Web Speech API.
 * - lang default 'pt-BR'
 * - acumula finais + interim para output contínuo
 * - reinicia automaticamente se o browser parar (Chrome corta após silêncio)
 */
export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionResult {
  const {
    lang = 'pt-BR',
    continuous = true,
    interimResults = true,
    onTranscript,
  } = opts

  const SR = useRef<SpeechRecognitionCtor | null>(null)
  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalRef = useRef<string>('')
  const shouldRestartRef = useRef<boolean>(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    SR.current = getSpeechRecognition()
    setSupported(!!SR.current)
  }, [])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
    setError(null)
  }, [])

  const start = useCallback(() => {
    if (!SR.current) return
    if (listening) return
    setError(null)
    const rec = new SR.current()
    rec.lang = lang
    rec.continuous = continuous
    rec.interimResults = interimResults

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const text = res[0].transcript
        if (res.isFinal) {
          finalRef.current += text + ' '
        } else {
          interim += text
        }
      }
      const full = (finalRef.current + interim).replace(/\s+/g, ' ').trim()
      setTranscript(full)
      onTranscript?.(full, interim === '')
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error || 'erro')
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        shouldRestartRef.current = false
      }
    }

    rec.onend = () => {
      // Chrome encerra automaticamente após silêncio — reinicia se ainda queria ouvir.
      if (shouldRestartRef.current) {
        try {
          rec.start()
          return
        } catch {
          /* ignore */
        }
      }
      setListening(false)
    }

    shouldRestartRef.current = true
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'falha ao iniciar')
      shouldRestartRef.current = false
      setListening(false)
    }
  }, [lang, continuous, interimResults, onTranscript, listening])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  return { supported, listening, transcript, error, start, stop, reset }
}
