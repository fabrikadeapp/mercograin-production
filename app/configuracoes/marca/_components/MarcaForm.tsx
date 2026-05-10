'use client'

import { useState, useRef } from 'react'
import { Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react'

interface Props {
  initialLogoUrl: string | null
  initialUploadedAt: string | null
  canEdit: boolean
}

export function MarcaForm({ initialLogoUrl, initialUploadedAt, canEdit }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [uploadedAt, setUploadedAt] = useState<string | null>(initialUploadedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/workspaces/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data?.error === 'too_large'
            ? 'Arquivo maior que 2MB.'
            : data?.error === 'invalid_type'
              ? 'Formato inválido. Use PNG, JPG ou SVG.'
              : data?.error === 'forbidden'
                ? 'Apenas owner/admin pode alterar a logo.'
                : data?.error || 'Falha no upload.'
        throw new Error(msg)
      }
      setLogoUrl(data.url)
      setUploadedAt(new Date().toISOString())
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remover logo customizada e voltar para a logo padrão BH Grain?')) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/workspaces/logo', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao remover.')
      setLogoUrl(null)
      setUploadedAt(null)
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Logo atual</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded border border-gray-200 min-h-[96px]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da empresa"
              className="max-h-16 max-w-[240px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#0a8a3a] text-white font-bold flex items-center justify-center text-xs">
                BH
              </div>
              <span className="text-base font-bold text-gray-900">
                BH <span className="font-normal text-[#0a8a3a]">Grain</span>
              </span>
              <span className="text-xs text-gray-500 ml-2">(logo padrão)</span>
            </div>
          )}
        </div>
        {uploadedAt && logoUrl ? (
          <p className="text-xs text-gray-500 mt-2">
            Atualizada em {new Date(uploadedAt).toLocaleString('pt-BR')}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {canEdit ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ações</h3>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0a8a3a] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {busy ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Fazer upload'}
            </button>
            {logoUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Remover logo customizada
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Formatos aceitos: PNG, JPG ou SVG. Tamanho máximo: 2MB. Recomendado: PNG transparente,
            altura mínima 96px.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <ImageIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Apenas owner ou admin do workspace podem alterar a logo.</span>
        </div>
      )}
    </div>
  )
}
