'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'

type Passo = 1 | 2 | 3

export default function NovaPropriedadePage() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params.id as string

  const [passo, setPasso] = useState<Passo>(1)
  const [salvando, setSalvando] = useState(false)
  const [consultandoCar, setConsultandoCar] = useState(false)
  const [carResultado, setCarResultado] = useState<any>(null)
  const [erro, setErro] = useState('')

  // Step 1
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [nirf, setNirf] = useState('')
  const [incra, setIncra] = useState('')

  // Step 2
  const [car, setCar] = useState('')

  // Step 3
  const [areaTotalHa, setAreaTotalHa] = useState('')
  const [areaPlantavelHa, setAreaPlantavelHa] = useState('')
  const [areaReservaLegal, setAreaReservaLegal] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [uf, setUf] = useState('')
  const [geoJsonText, setGeoJsonText] = useState('')

  async function consultarCar() {
    setErro('')
    setConsultandoCar(true)
    setCarResultado(null)
    try {
      const r = await fetch('/api/propriedades/consultar-car', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ car }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErro(data.error || 'Erro')
      } else {
        setCarResultado(data)
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro')
    } finally {
      setConsultandoCar(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      let geoJson: any = undefined
      if (geoJsonText.trim()) {
        try {
          geoJson = JSON.parse(geoJsonText)
        } catch {
          setErro('GeoJSON inválido')
          setSalvando(false)
          return
        }
      }
      const payload: any = {
        produtorId: clienteId,
        nome,
        matricula: matricula || undefined,
        nirf: nirf || undefined,
        incra: incra || undefined,
        car: car || undefined,
        areaTotalHa: areaTotalHa ? parseFloat(areaTotalHa) : undefined,
        areaPlantavelHa: areaPlantavelHa ? parseFloat(areaPlantavelHa) : undefined,
        areaReservaLegal: areaReservaLegal ? parseFloat(areaReservaLegal) : undefined,
        municipio: municipio || undefined,
        uf: uf ? uf.toUpperCase() : undefined,
        geoJson,
      }
      const r = await fetch('/api/propriedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) {
        setErro(data.error || 'Erro ao salvar')
        return
      }
      router.push(`/clientes/${clienteId}/propriedades`)
    } catch (e: any) {
      setErro(e?.message || 'Erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Nova Propriedade Rural"
        subtitle={`Passo ${passo} de 3`}
        actions={
          <Link href={`/clientes/${clienteId}/propriedades`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
          </Link>
        }
      />

      <Card>
        {/* Stepper visual */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`flex-1 h-2 rounded ${
                passo >= n ? 'bg-emerald-500' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {erro}
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">1. Dados básicos</h3>
            <Input
              label="Nome da propriedade *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Fazenda Santa Helena"
            />
            <Input
              label="Matrícula no cartório"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
            />
            <Input
              label="NIRF (Receita Federal)"
              value={nirf}
              onChange={(e) => setNirf(e.target.value)}
            />
            <Input
              label="INCRA / CCIR"
              value={incra}
              onChange={(e) => setIncra(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={() => setPasso(2)} disabled={!nome}>
                Próximo
              </Button>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">2. CAR — Cadastro Ambiental Rural</h3>
            <p className="text-sm text-neutral-600">
              Formato: <code>UF-IBGE7-HASH</code> (ex.: RS-4314902-AB12...)
            </p>
            <div className="flex gap-2 items-end">
              <Input
                label="Código CAR"
                value={car}
                onChange={(e) => setCar(e.target.value.toUpperCase())}
                placeholder="RS-4314902-..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={consultarCar}
                disabled={!car || consultandoCar}
              >
                {consultandoCar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Consultar SICAR'
                )}
              </Button>
            </div>

            {carResultado && (
              <div className="p-3 bg-neutral-50 border rounded text-sm space-y-1">
                <div>
                  <strong>Status:</strong> {carResultado.status}
                </div>
                <div>
                  <strong>UF / Município:</strong> {carResultado.uf} / {carResultado.municipio}
                </div>
                <div className="text-xs text-neutral-500">
                  Fonte: {carResultado.fonte}
                  {carResultado.fonte === 'mock' &&
                    ' (consulta SICAR oficial requer integração paga — apenas formato validado)'}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setPasso(1)}>
                Voltar
              </Button>
              <Button onClick={() => setPasso(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">3. Áreas e localização</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Área total (ha)"
                type="number"
                value={areaTotalHa}
                onChange={(e) => setAreaTotalHa(e.target.value)}
              />
              <Input
                label="Área plantável (ha)"
                type="number"
                value={areaPlantavelHa}
                onChange={(e) => setAreaPlantavelHa(e.target.value)}
              />
              <Input
                label="Reserva legal (ha)"
                type="number"
                value={areaReservaLegal}
                onChange={(e) => setAreaReservaLegal(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Município"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
              />
              <Input
                label="UF"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GeoJSON (opcional)</label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                value={geoJsonText}
                onChange={(e) => setGeoJsonText(e.target.value)}
                placeholder='{"type":"FeatureCollection","features":[...]}'
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setPasso(2)}>
                Voltar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Salvar propriedade
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
