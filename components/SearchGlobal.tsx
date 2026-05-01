'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResults {
  clientes: Array<{ id: string; nome: string; email?: string; tipo: string }>
  propostas: Array<{ id: string; numero: string; status: string; cliente: { nome: string } }>
  contratos: Array<{ id: string; numero: string; statusAssinatura: string; cliente: { nome: string } }>
  boletos: Array<{ id: string; numero: string; status: string; valor: any; cliente: { nome: string } }>
  query: string
}

export function SearchGlobal() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults(null)
      return
    }

    const searchAsync = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/busca?q=${encodeURIComponent(query)}`)
        if (!response.ok) throw new Error('Erro na busca')
        const data = await response.json()
        setResults(data)
        setIsOpen(true)
      } catch (error) {
        console.error('Busca error:', error)
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(searchAsync, 300)
    return () => clearTimeout(timer)
  }, [query])

  const hasResults = results && (
    results.clientes.length > 0 ||
    results.propostas.length > 0 ||
    results.contratos.length > 0 ||
    results.boletos.length > 0
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && hasResults && setIsOpen(true)}
        placeholder="🔍 Buscar propostas, contratos, boletos..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Buscando...
            </div>
          ) : hasResults ? (
            <div className="max-h-96 overflow-y-auto">
              {/* Clientes */}
              {results.clientes.length > 0 && (
                <div className="border-b">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600">
                    👥 CLIENTES ({results.clientes.length})
                  </div>
                  {results.clientes.map((cliente) => (
                    <Link key={cliente.id} href={`/clientes`}>
                      <div className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b">
                        <p className="font-medium text-gray-900">{cliente.nome}</p>
                        <p className="text-xs text-gray-500">{cliente.tipo}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Propostas */}
              {results.propostas.length > 0 && (
                <div className="border-b">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600">
                    📄 PROPOSTAS ({results.propostas.length})
                  </div>
                  {results.propostas.map((proposta) => (
                    <Link key={proposta.id} href={`/propostas/${proposta.id}`}>
                      <div className="px-4 py-2 hover:bg-purple-50 cursor-pointer border-b">
                        <p className="font-medium text-gray-900">PROP-{proposta.numero}</p>
                        <p className="text-xs text-gray-500">{proposta.cliente.nome}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Contratos */}
              {results.contratos.length > 0 && (
                <div className="border-b">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600">
                    🤝 CONTRATOS ({results.contratos.length})
                  </div>
                  {results.contratos.map((contrato) => (
                    <Link key={contrato.id} href={`/contratos/${contrato.id}`}>
                      <div className="px-4 py-2 hover:bg-green-50 cursor-pointer border-b">
                        <p className="font-medium text-gray-900">CTR-{contrato.numero}</p>
                        <p className="text-xs text-gray-500">{contrato.cliente.nome}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Boletos */}
              {results.boletos.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600">
                    💰 BOLETOS ({results.boletos.length})
                  </div>
                  {results.boletos.map((boleto) => (
                    <Link key={boleto.id} href={`/boletos/${boleto.id}`}>
                      <div className="px-4 py-2 hover:bg-orange-50 cursor-pointer border-b last:border-b-0">
                        <p className="font-medium text-gray-900">BLT-{boleto.numero}</p>
                        <p className="text-xs text-gray-500">{boleto.cliente.nome}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Nenhum resultado encontrado para "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
