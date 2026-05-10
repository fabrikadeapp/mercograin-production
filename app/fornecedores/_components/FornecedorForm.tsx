'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { isValidCNPJ, formatCNPJ } from '@/lib/br/documento'

const TIPO_OPCOES = [
  { value: 'transportadora', label: 'Transportadora' },
  { value: 'armazem', label: 'Armazém' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'certificadora', label: 'Certificadora' },
  { value: 'outros', label: 'Outros' },
]

const UF_OPCOES = [
  { value: '', label: 'UF' },
  ...[
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ].map((u) => ({ value: u, label: u })),
]

export type FornecedorTipo =
  | 'transportadora'
  | 'armazem'
  | 'insumos'
  | 'certificadora'
  | 'outros'

export interface FornecedorInitial {
  id?: string
  tipo?: FornecedorTipo
  razaoSocial?: string
  nomeFantasia?: string | null
  cnpj?: string | null
  contato?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  observacao?: string | null
  ativo?: boolean
  metadata?: Record<string, any> | null
}

interface FornecedorFormProps {
  mode: 'create' | 'update'
  fornecedorId?: string
  initial?: FornecedorInitial
}

function maskCNPJ(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\) (\d)(\d{4})/, '($1) $2 $3')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function FornecedorForm({
  mode,
  fornecedorId,
  initial,
}: FornecedorFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cnpjLookingUp, setCnpjLookingUp] = React.useState(false)
  const [cnpjFieldError, setCnpjFieldError] = React.useState<string | null>(
    null
  )

  const meta = (initial?.metadata || {}) as Record<string, any>

  const [tipo, setTipo] = React.useState<FornecedorTipo>(
    initial?.tipo || 'transportadora'
  )
  const [razaoSocial, setRazaoSocial] = React.useState(initial?.razaoSocial || '')
  const [nomeFantasia, setNomeFantasia] = React.useState(
    initial?.nomeFantasia || ''
  )
  const [cnpj, setCnpj] = React.useState(initial?.cnpj || '')
  const [contato, setContato] = React.useState(initial?.contato || '')
  const [telefone, setTelefone] = React.useState(initial?.telefone || '')
  const [email, setEmail] = React.useState(initial?.email || '')
  const [endereco, setEndereco] = React.useState(initial?.endereco || '')
  const [cidade, setCidade] = React.useState(initial?.cidade || '')
  const [uf, setUf] = React.useState(initial?.uf || '')
  const [observacao, setObservacao] = React.useState(initial?.observacao || '')
  const [ativo, setAtivo] = React.useState(initial?.ativo ?? true)

  // Metadata por tipo
  const [placaPrincipal, setPlacaPrincipal] = React.useState(
    meta.placaPrincipal || ''
  )
  const [antt, setAntt] = React.useState(meta.antt || '')
  const [frota, setFrota] = React.useState(
    meta.frota !== undefined ? String(meta.frota) : ''
  )
  const [regiaoCobertura, setRegiaoCobertura] = React.useState(
    meta.regiaoCobertura || ''
  )
  const [capacidadeSc, setCapacidadeSc] = React.useState(
    meta.capacidadeSc !== undefined ? String(meta.capacidadeSc) : ''
  )
  const [tipoArmazem, setTipoArmazem] = React.useState(meta.tipoArmazem || '')
  const [municipioOperacao, setMunicipioOperacao] = React.useState(
    meta.municipioOperacao || ''
  )
  const [produtosPrincipais, setProdutosPrincipais] = React.useState(
    meta.produtosPrincipais || ''
  )
  const [certificacoes, setCertificacoes] = React.useState(
    meta.certificacoes || ''
  )

  function buildMetadata(): Record<string, any> {
    if (tipo === 'transportadora') {
      return {
        placaPrincipal: placaPrincipal || undefined,
        antt: antt || undefined,
        frota: frota ? Number(frota) : undefined,
        regiaoCobertura: regiaoCobertura || undefined,
      }
    }
    if (tipo === 'armazem') {
      return {
        capacidadeSc: capacidadeSc ? Number(capacidadeSc) : undefined,
        tipoArmazem: tipoArmazem || undefined,
        municipioOperacao: municipioOperacao || undefined,
      }
    }
    if (tipo === 'insumos') {
      return { produtosPrincipais: produtosPrincipais || undefined }
    }
    if (tipo === 'certificadora') {
      return { certificacoes: certificacoes || undefined }
    }
    return {}
  }

  /**
   * Ao sair do campo CNPJ:
   *  1) valida dígitos (economiza chamada externa)
   *  2) consulta /api/br/cnpj e auto-preenche campos vazios
   */
  async function handleCnpjBlur() {
    const clean = cnpj.replace(/\D/g, '')
    if (clean.length === 0) {
      setCnpjFieldError(null)
      return
    }
    if (clean.length !== 14 || !isValidCNPJ(clean)) {
      setCnpjFieldError('CNPJ inválido')
      return
    }
    setCnpjFieldError(null)
    setCnpj(formatCNPJ(clean))

    setCnpjLookingUp(true)
    try {
      const r = await fetch(`/api/br/cnpj/${clean}`)
      if (!r.ok) return
      const j = await r.json()
      // não sobrescreve o que o usuário já digitou
      if (!razaoSocial && j.razaoSocial) setRazaoSocial(j.razaoSocial)
      if (!nomeFantasia && j.nomeFantasia) setNomeFantasia(j.nomeFantasia)
      if (!email && j.email) setEmail(j.email)
      if (!telefone && j.telefone) setTelefone(j.telefone)
      if (!endereco) {
        const partes = [
          j.logradouro,
          j.numero,
          j.complemento,
          j.bairro,
          j.cep ? `CEP ${j.cep}` : null,
        ].filter(Boolean)
        if (partes.length > 0) setEndereco(partes.join(', '))
      }
      if (!cidade && j.municipio) setCidade(j.municipio)
      if (!uf && j.uf) setUf(j.uf)
    } catch (err) {
      console.error('cnpj lookup failed', err)
    } finally {
      setCnpjLookingUp(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!razaoSocial.trim()) {
      setError('Razão social é obrigatória')
      return
    }

    if (cnpj && cnpj.replace(/\D/g, '').length > 0 && !isValidCNPJ(cnpj)) {
      setError('CNPJ inválido')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        tipo,
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia || null,
        cnpj: cnpj || null,
        contato: contato || null,
        telefone: telefone || null,
        email: email || null,
        endereco: endereco || null,
        cidade: cidade || null,
        uf: uf || null,
        observacao: observacao || null,
        ativo,
        metadata: buildMetadata(),
      }

      const url =
        mode === 'create'
          ? '/api/fornecedores'
          : `/api/fornecedores/${fornecedorId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const res = await response.json().catch(() => ({}))
        throw new Error(res.error || 'Erro ao salvar fornecedor')
      }

      router.push('/fornecedores')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor')
    } finally {
      setSubmitting(false)
    }
  }

  const titulo = mode === 'create' ? 'Novo fornecedor' : 'Editar fornecedor'

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cadastros · Suprimentos"
        title={titulo}
        subtitle="Cadastre transportadoras, armazéns, insumos e certificadoras."
        search={false}
        actions={
          <Link href="/fornecedores">
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Voltar
            </Button>
          </Link>
        }
      />

      {error && (
        <Card className="mb-4 border-neg/40">
          <p className="text-neg text-small">{error}</p>
        </Card>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Select
              label="Tipo *"
              options={TIPO_OPCOES}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as FornecedorTipo)}
            />
            <Input
              label="Razão social *"
              placeholder="Empresa LTDA"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome fantasia"
                placeholder="Marca comercial"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
              />
              <Input
                label={cnpjLookingUp ? 'CNPJ · consultando…' : 'CNPJ'}
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => {
                  setCnpj(maskCNPJ(e.target.value))
                  if (cnpjFieldError) setCnpjFieldError(null)
                }}
                onBlur={handleCnpjBlur}
                error={cnpjFieldError || undefined}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Pessoa de contato"
                placeholder="Nome do responsável"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
              />
              <Input
                label="Telefone"
                placeholder="(00) 0 0000-0000"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="contato@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Endereço</p>
            <div>
              <label className="block text-small text-fg-2 mb-1.5">
                Endereço completo
              </label>
              <textarea
                className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-accent"
                rows={2}
                value={endereco}
                placeholder="Rua, número, complemento, bairro"
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label="Cidade"
                  placeholder="Cuiabá"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>
              <Select
                label="UF"
                options={UF_OPCOES}
                value={uf}
                onChange={(e) => setUf(e.target.value)}
              />
            </div>
          </section>

          {tipo === 'transportadora' && (
            <section className="space-y-4">
              <p className="eyebrow">Detalhes · Transportadora</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Placa principal"
                  placeholder="ABC1D23"
                  value={placaPrincipal}
                  onChange={(e) => setPlacaPrincipal(e.target.value)}
                />
                <Input
                  label="ANTT (RNTRC)"
                  placeholder="00000000"
                  value={antt}
                  onChange={(e) => setAntt(e.target.value)}
                />
                <Input
                  label="Frota (nº veículos)"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={frota}
                  onChange={(e) => setFrota(e.target.value)}
                />
                <Input
                  label="Região de cobertura"
                  placeholder="Centro-Oeste, MT/MS"
                  value={regiaoCobertura}
                  onChange={(e) => setRegiaoCobertura(e.target.value)}
                />
              </div>
            </section>
          )}

          {tipo === 'armazem' && (
            <section className="space-y-4">
              <p className="eyebrow">Detalhes · Armazém</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Capacidade (sacas)"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={capacidadeSc}
                  onChange={(e) => setCapacidadeSc(e.target.value)}
                />
                <Select
                  label="Tipo de armazém"
                  options={[
                    { value: '', label: 'Selecione' },
                    { value: 'silo', label: 'Silo' },
                    { value: 'granel', label: 'Granel' },
                    { value: 'horizontal', label: 'Horizontal' },
                  ]}
                  value={tipoArmazem}
                  onChange={(e) => setTipoArmazem(e.target.value)}
                />
                <Input
                  label="Município de operação"
                  placeholder="Sorriso"
                  value={municipioOperacao}
                  onChange={(e) => setMunicipioOperacao(e.target.value)}
                />
              </div>
            </section>
          )}

          {tipo === 'insumos' && (
            <section className="space-y-4">
              <p className="eyebrow">Detalhes · Insumos</p>
              <div>
                <label className="block text-small text-fg-2 mb-1.5">
                  Produtos principais (separe por vírgula)
                </label>
                <textarea
                  className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-accent"
                  rows={3}
                  value={produtosPrincipais}
                  placeholder="Glifosato, Adubo NPK, Sementes..."
                  onChange={(e) => setProdutosPrincipais(e.target.value)}
                />
              </div>
            </section>
          )}

          {tipo === 'certificadora' && (
            <section className="space-y-4">
              <p className="eyebrow">Detalhes · Certificadora</p>
              <div>
                <label className="block text-small text-fg-2 mb-1.5">
                  Certificações oferecidas
                </label>
                <textarea
                  className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-accent"
                  rows={3}
                  value={certificacoes}
                  placeholder="ISO 9001, RTRS, ProTerra..."
                  onChange={(e) => setCertificacoes(e.target.value)}
                />
              </div>
            </section>
          )}

          <section className="space-y-4">
            <p className="eyebrow">Observação</p>
            <textarea
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-accent"
              rows={3}
              value={observacao}
              placeholder="Notas internas, condições comerciais..."
              onChange={(e) => setObservacao(e.target.value)}
            />
          </section>

          <section className="space-y-3">
            <p className="eyebrow">Status</p>
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 rounded border-border-1 bg-bg-2 accent-accent"
              />
              <span className="text-small text-fg-1">
                Fornecedor ativo
              </span>
              <span className="text-fg-3 text-micro">
                (desmarque para arquivar sem excluir)
              </span>
            </label>
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/fornecedores">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={submitting}>
              {submitting
                ? 'Salvando…'
                : mode === 'create'
                ? 'Criar fornecedor'
                : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
