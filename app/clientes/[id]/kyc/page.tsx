'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

export default function KycPage() {
  const params = useParams()
  const clienteId = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/clientes/${clienteId}/kyc`)
    if (r.ok) {
      const c = await r.json()
      setData({ cliente: c, resultado: c.kycResultado })
    }
    setLoading(false)
  }

  async function rodar() {
    setRodando(true)
    setErro('')
    try {
      const r = await fetch(`/api/clientes/${clienteId}/kyc`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        setErro(d.error || 'Falha')
      } else {
        await load()
      }
    } finally {
      setRodando(false)
    }
  }

  useEffect(() => {
    load()
  }, [clienteId])

  const resultado = data?.resultado
  const cliente = data?.cliente

  function statusColor(s?: string) {
    if (s === 'aprovado') return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    if (s === 'reprovado') return 'bg-red-100 text-red-700 border-red-300'
    if (s === 'pendencias') return 'bg-amber-100 text-amber-700 border-amber-300'
    return 'bg-neutral-100 text-neutral-700 border-neutral-300'
  }

  function StatusIcon({ s }: { s?: string }) {
    if (s === 'aprovado') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    if (s === 'reprovado') return <XCircle className="w-5 h-5 text-red-600" />
    if (s === 'pendencias') return <AlertCircle className="w-5 h-5 text-amber-600" />
    return <AlertCircle className="w-5 h-5 text-neutral-500" />
  }

  return (
    <AppShell>
      <PageHeader
        title="Compliance KYC"
        subtitle={cliente?.nome || ''}
        actions={
          <div className="flex gap-2">
            <Link href={`/clientes/${clienteId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            </Link>
            <Button onClick={rodar} disabled={rodando}>
              {rodando ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Rodar verificação
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card>Carregando…</Card>
      ) : (
        <div className="space-y-4">
          {erro && (
            <Card>
              <div className="text-red-700">{erro}</div>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-3">
              <StatusIcon s={resultado?.status || cliente?.kycStatus} />
              <div className="flex-1">
                <div className="text-sm text-neutral-600">Status atual</div>
                <div
                  className={`inline-block mt-1 px-3 py-1 rounded-full border text-sm font-medium ${statusColor(
                    resultado?.status || cliente?.kycStatus,
                  )}`}
                >
                  {resultado?.status || cliente?.kycStatus || 'não verificado'}
                </div>
                {(resultado?.rodadoEm || cliente?.kycRodadoEm) && (
                  <div className="text-xs text-neutral-500 mt-1">
                    Última verificação:{' '}
                    {new Date(resultado?.rodadoEm || cliente?.kycRodadoEm).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {resultado?.alertas && resultado.alertas.length > 0 && (
            <Card>
              <h3 className="font-semibold mb-2">Alertas ({resultado.alertas.length})</h3>
              <ul className="space-y-1 text-sm">
                {resultado.alertas.map((a: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {resultado?.verificacoes && (
            <Card>
              <h3 className="font-semibold mb-3">Detalhes das verificações</h3>
              <div className="space-y-3 text-sm">
                {resultado.verificacoes.cnpj && (
                  <div className="border rounded p-3">
                    <div className="font-medium">CNPJ (BrasilAPI/ReceitaWS)</div>
                    <div className="text-neutral-600">
                      Status: {resultado.verificacoes.cnpj.ok ? 'consultado' : 'falhou'}
                      {resultado.verificacoes.cnpj.dados?.situacao &&
                        ` • Situação: ${resultado.verificacoes.cnpj.dados.situacao}`}
                    </div>
                  </div>
                )}
                {resultado.verificacoes.cgu && (
                  <div className="border rounded p-3">
                    <div className="font-medium">CGU — Portal da Transparência</div>
                    <div className="text-neutral-600">
                      CEIS: {resultado.verificacoes.cgu.ceis.temRegistro ? 'COM REGISTRO' : 'limpo'}
                      {' • '}CNEP: {resultado.verificacoes.cgu.cnep.temRegistro ? 'COM REGISTRO' : 'limpo'}
                      {' • '}CEPIM: {resultado.verificacoes.cgu.cepim.temRegistro ? 'COM REGISTRO' : 'limpo'}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Fonte: {resultado.verificacoes.cgu.fonte}
                    </div>
                  </div>
                )}
                {resultado.verificacoes.trabalhoEscravo && (
                  <div className="border rounded p-3">
                    <div className="font-medium">Trabalho Escravo (gov.br)</div>
                    <div className="text-neutral-600">
                      {resultado.verificacoes.trabalhoEscravo.temRegistro
                        ? `COM REGISTRO (${resultado.verificacoes.trabalhoEscravo.registros.length})`
                        : 'limpo'}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Fonte: {resultado.verificacoes.trabalhoEscravo.fonte}
                    </div>
                  </div>
                )}
                {resultado.verificacoes.pep && (
                  <div className="border rounded p-3">
                    <div className="font-medium">PEP — Pessoa Exposta Politicamente</div>
                    <div className="text-neutral-600">
                      {resultado.verificacoes.pep.pep ? 'É PEP' : 'não é PEP'}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Fonte: {resultado.verificacoes.pep.fonte}
                    </div>
                  </div>
                )}
                {resultado.verificacoes.sicar && resultado.verificacoes.sicar.length > 0 && (
                  <div className="border rounded p-3">
                    <div className="font-medium">SICAR (CARs das propriedades)</div>
                    <ul className="mt-1 space-y-1 text-neutral-600">
                      {resultado.verificacoes.sicar.map((s: any, i: number) => (
                        <li key={i}>
                          {s.nome}: {s.resultado?.status || 'inválido'} ({s.resultado?.fonte || '—'})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  )
}
