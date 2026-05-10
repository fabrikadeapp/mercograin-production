'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'

export default function PropriedadeDetalhePage() {
  const params = useParams()
  const clienteId = params.id as string
  const propId = params.propId as string
  const [prop, setProp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/propriedades/${propId}`)
    const data = await r.json()
    if (r.ok) setProp(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [propId])

  function set(k: string, v: any) {
    setProp((p: any) => ({ ...p, [k]: v }))
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    const payload: any = {
      nome: prop.nome,
      matricula: prop.matricula,
      cartorio: prop.cartorio,
      nirf: prop.nirf,
      incra: prop.incra,
      car: prop.car || null,
      areaTotalHa: prop.areaTotalHa ? Number(prop.areaTotalHa) : null,
      areaPlantavelHa: prop.areaPlantavelHa ? Number(prop.areaPlantavelHa) : null,
      areaReservaLegal: prop.areaReservaLegal ? Number(prop.areaReservaLegal) : null,
      municipio: prop.municipio,
      uf: prop.uf,
    }
    const r = await fetch(`/api/propriedades/${propId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    if (!r.ok) setErro(data.error || 'Erro')
    setSalvando(false)
  }

  if (loading) return <AppShell><Card>Carregando…</Card></AppShell>
  if (!prop) return <AppShell><Card>Propriedade não encontrada.</Card></AppShell>

  return (
    <AppShell>
      <PageHeader
        title={prop.nome}
        subtitle="Detalhe da propriedade rural"
        actions={
          <Link href={`/clientes/${clienteId}/propriedades`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </Link>
        }
      />
      <Card>
        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {erro}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome" value={prop.nome || ''} onChange={(e) => set('nome', e.target.value)} />
          <Input label="Matrícula" value={prop.matricula || ''} onChange={(e) => set('matricula', e.target.value)} />
          <Input label="Cartório" value={prop.cartorio || ''} onChange={(e) => set('cartorio', e.target.value)} />
          <Input label="NIRF" value={prop.nirf || ''} onChange={(e) => set('nirf', e.target.value)} />
          <Input label="INCRA" value={prop.incra || ''} onChange={(e) => set('incra', e.target.value)} />
          <Input label="CAR" value={prop.car || ''} onChange={(e) => set('car', e.target.value.toUpperCase())} />
          <Input label="Área total (ha)" type="number" value={prop.areaTotalHa ?? ''} onChange={(e) => set('areaTotalHa', e.target.value)} />
          <Input label="Área plantável (ha)" type="number" value={prop.areaPlantavelHa ?? ''} onChange={(e) => set('areaPlantavelHa', e.target.value)} />
          <Input label="Reserva legal (ha)" type="number" value={prop.areaReservaLegal ?? ''} onChange={(e) => set('areaReservaLegal', e.target.value)} />
          <Input label="Município" value={prop.municipio || ''} onChange={(e) => set('municipio', e.target.value)} />
          <Input label="UF" maxLength={2} value={prop.uf || ''} onChange={(e) => set('uf', e.target.value.toUpperCase())} />
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar alterações
          </Button>
        </div>
      </Card>
    </AppShell>
  )
}
