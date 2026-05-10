'use client'
import * as React from 'react'
import { Card, Input, Select, Button, Chip } from '@/components/ui/phb'
import {
  classificarCarga,
  PADROES_DEFAULT,
  type Cultura,
} from '@/lib/operacao-fisica/classificacao'

interface RomaneioOpt {
  id: string
  numero: string
  cultura: string
  origem: string
  destino: string
}
interface BalancaOpt {
  id: string
  nome: string
}

export function BalancaWorkstation({
  romaneios,
  balancas,
  defaultRomaneioId,
}: {
  romaneios: RomaneioOpt[]
  balancas: BalancaOpt[]
  defaultRomaneioId?: string
}) {
  const [romaneioId, setRomaneioId] = React.useState(defaultRomaneioId || '')
  const [balancaId, setBalancaId] = React.useState(balancas[0]?.id || '')
  const [pesoBruto, setPesoBruto] = React.useState('')
  const [tara, setTara] = React.useState('')
  const [placa, setPlaca] = React.useState('')
  const [umidade, setUmidade] = React.useState('')
  const [impureza, setImpureza] = React.useState('')
  const [ardidos, setArdidos] = React.useState('')
  const [quebrados, setQuebrados] = React.useState('')
  const [obs, setObs] = React.useState('')
  const [tipo, setTipo] = React.useState<'recepcao' | 'expedicao' | 'transferencia'>(
    'recepcao'
  )
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const romaneio = romaneios.find((r) => r.id === romaneioId)
  const cultura: Cultura = (romaneio?.cultura as Cultura) || 'soja'

  const pesoBrutoNum = parseFloat(pesoBruto) || 0
  const taraNum = parseFloat(tara) || 0
  const pesoLiquido = Math.max(0, pesoBrutoNum - taraNum)

  const classifLive = React.useMemo(() => {
    if (!umidade && !impureza && !ardidos && !quebrados) return null
    const padrao = { cultura, ...PADROES_DEFAULT[cultura] }
    return classificarCarga(
      {
        umidade: parseFloat(umidade) || 0,
        impureza: parseFloat(impureza) || 0,
        ardidos: parseFloat(ardidos) || 0,
        quebrados: parseFloat(quebrados) || 0,
      },
      padrao,
      pesoLiquido
    )
  }, [umidade, impureza, ardidos, quebrados, cultura, pesoLiquido])

  function reset(keepRomaneio = true) {
    setPesoBruto('')
    setTara('')
    setPlaca('')
    setUmidade('')
    setImpureza('')
    setArdidos('')
    setQuebrados('')
    setObs('')
    if (!keepRomaneio) setRomaneioId('')
  }

  async function salvar() {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      let classificacaoId: string | null = null
      if (classifLive) {
        const r = await fetch('/api/classificacoes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cultura,
            umidade: parseFloat(umidade) || 0,
            impureza: parseFloat(impureza) || 0,
            ardidos: parseFloat(ardidos) || 0,
            quebrados: parseFloat(quebrados) || 0,
            pesoBrutoKg: pesoLiquido,
          }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro classif')
        classificacaoId = j.classificacao.id
      }
      const r2 = await fetch('/api/tickets-balanca', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo,
          romaneioId: romaneioId || null,
          balancaId: balancaId || null,
          pesoBrutoKg: pesoBrutoNum,
          taraKg: taraNum,
          cultura,
          classificacaoId,
          placa: placa || null,
          observacoes: obs || null,
        }),
      })
      const j2 = await r2.json()
      if (!r2.ok) throw new Error(j2.error || 'Erro ticket')
      setMsg(`Ticket ${j2.numero} salvo. Pronto pra próximo.`)
      reset(true)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-semibold mb-3">Romaneio & balança</h3>
        <div className="space-y-3">
          <Select
            label="Romaneio"
            value={romaneioId}
            onChange={(e) => setRomaneioId(e.target.value)}
            placeholder="Selecione o romaneio"
            options={romaneios.map((r) => ({
              value: r.id,
              label: `${r.numero} · ${r.cultura} · ${r.origem}→${r.destino}`,
            }))}
          />
          <Select
            label="Balança"
            value={balancaId}
            onChange={(e) => setBalancaId(e.target.value)}
            options={balancas.map((b) => ({ value: b.id, label: b.nome }))}
          />
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
            options={[
              { value: 'recepcao', label: 'Recepção' },
              { value: 'expedicao', label: 'Expedição' },
              { value: 'transferencia', label: 'Transferência' },
            ]}
          />
          <Input
            label="Placa do veículo"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            placeholder="ABC1D23"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Pesagem</h3>
        <div className="space-y-3">
          <Input
            label="Peso bruto (kg)"
            type="number"
            value={pesoBruto}
            onChange={(e) => setPesoBruto(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Tara (kg)"
            type="number"
            value={tara}
            onChange={(e) => setTara(e.target.value)}
            placeholder="0"
          />
          <div className="flex justify-between items-center bg-zinc-900/40 rounded p-3">
            <span className="eyebrow">Peso líquido</span>
            <span className="text-2xl font-mono text-emerald-400">
              {pesoLiquido.toLocaleString('pt-BR')} kg
            </span>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="font-semibold mb-3">Classificação ({cultura})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Input
            label="Umidade %"
            type="number"
            step="0.1"
            value={umidade}
            onChange={(e) => setUmidade(e.target.value)}
          />
          <Input
            label="Impureza %"
            type="number"
            step="0.1"
            value={impureza}
            onChange={(e) => setImpureza(e.target.value)}
          />
          <Input
            label="Ardidos %"
            type="number"
            step="0.1"
            value={ardidos}
            onChange={(e) => setArdidos(e.target.value)}
          />
          <Input
            label="Quebrados %"
            type="number"
            step="0.1"
            value={quebrados}
            onChange={(e) => setQuebrados(e.target.value)}
          />
        </div>
        {classifLive ? (
          <div className="bg-zinc-900/40 rounded p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
            <div>
              <span className="eyebrow">Desc. umidade</span>
              <p>{classifLive.descontoUmidadePct}%</p>
            </div>
            <div>
              <span className="eyebrow">Desc. impureza</span>
              <p>{classifLive.descontoImpurezaPct}%</p>
            </div>
            <div>
              <span className="eyebrow">Desc. total</span>
              <p className="text-emerald-400 font-bold">{classifLive.descontoTotalPct}%</p>
            </div>
            <div>
              <span className="eyebrow">Líquido final</span>
              <p className="font-mono">
                {classifLive.pesoLiquidoFinalKg.toLocaleString('pt-BR')} kg
              </p>
            </div>
            {classifLive.alertaForaPadrao.length > 0 ? (
              <div className="col-span-full">
                {classifLive.alertaForaPadrao.map((a, i) => (
                  <Chip key={i} variant="warn" className="mr-2 mt-1">
                    {a}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <Input
          label="Observações"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Notas operacionais"
        />
      </Card>

      <div className="lg:col-span-2 flex items-center gap-3">
        {err ? <p className="text-small text-neg flex-1">{err}</p> : null}
        {msg ? <p className="text-small text-emerald-400 flex-1">{msg}</p> : null}
        <Button variant="ghost" onClick={() => reset(false)}>
          Limpar tudo
        </Button>
        <Button
          onClick={salvar}
          loading={loading}
          disabled={!pesoBruto || !tara || pesoBrutoNum < taraNum}
        >
          Salvar ticket e próximo
        </Button>
      </div>
    </div>
  )
}
