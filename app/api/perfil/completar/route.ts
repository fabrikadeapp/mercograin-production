import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidCPF } from '@/lib/br/documento'
import { isValidPixKey, isValidTelefoneBR, onlyDigits, type PixTipo } from '@/lib/equipe/rh'

export const dynamic = 'force-dynamic'

const PIX_TIPOS = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] as const
const TIPOS_CONTA = ['corrente', 'poupanca', 'pagamento'] as const

const schema = z.object({
  // Passo 1 — dados pessoais
  cpf: z.string().min(11),
  rg: z.string().trim().min(3).max(20),
  rgEmissor: z.string().trim().max(20).optional().nullable(),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pis: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().min(10),
  // Passo 2 — endereço
  enderecoCep: z.string().min(8),
  enderecoRua: z.string().trim().min(2),
  enderecoNumero: z.string().trim().min(1),
  enderecoComplemento: z.string().trim().max(120).optional().nullable(),
  enderecoBairro: z.string().trim().min(1),
  enderecoCidade: z.string().trim().min(2),
  enderecoUF: z.string().length(2),
  // Passo 3 — banco + emergência
  dadosBancarios: z.object({
    banco: z.string().trim().min(1),
    bancoNome: z.string().trim().min(1),
    agencia: z.string().trim().min(1),
    conta: z.string().trim().min(1),
    tipo: z.enum(TIPOS_CONTA),
    titular: z.string().trim().min(2),
    pix: z.string().trim().optional().default(''),
    pixTipo: z.enum(PIX_TIPOS).optional().nullable(),
  }),
  contatoEmergenciaNome: z.string().trim().min(2),
  contatoEmergenciaTelefone: z.string().min(10),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'invalid', field: parsed.error.errors[0]?.path?.join('.') },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Validações de negócio
  const cpfDigits = onlyDigits(d.cpf)
  if (!isValidCPF(cpfDigits)) {
    return NextResponse.json({ error: 'CPF inválido', field: 'cpf' }, { status: 400 })
  }
  if (!isValidTelefoneBR(d.telefone)) {
    return NextResponse.json({ error: 'Telefone inválido', field: 'telefone' }, { status: 400 })
  }
  if (!isValidTelefoneBR(d.contatoEmergenciaTelefone)) {
    return NextResponse.json(
      { error: 'Telefone de emergência inválido', field: 'contatoEmergenciaTelefone' },
      { status: 400 },
    )
  }
  if (onlyDigits(d.enderecoCep).length !== 8) {
    return NextResponse.json({ error: 'CEP inválido', field: 'enderecoCep' }, { status: 400 })
  }
  // PIX é opcional, mas se preenchido precisa ter tipo válido e formato
  if (d.dadosBancarios.pix && d.dadosBancarios.pix.trim().length > 0) {
    const pt = d.dadosBancarios.pixTipo as PixTipo | null | undefined
    if (!pt || !isValidPixKey(pt, d.dadosBancarios.pix)) {
      return NextResponse.json(
        { error: 'Chave PIX inválida para o tipo informado', field: 'dadosBancarios.pix' },
        { status: 400 },
      )
    }
  }

  // Verifica CPF não duplicado (em outro usuário)
  const cpfOwner = await db.user.findUnique({
    where: { cpf: cpfDigits },
    select: { id: true },
  })
  if (cpfOwner && cpfOwner.id !== session.user.id) {
    return NextResponse.json(
      { error: 'Este CPF já está cadastrado em outra conta.', field: 'cpf' },
      { status: 409 },
    )
  }

  const dataNasc = new Date(d.dataNascimento + 'T00:00:00.000Z')
  if (Number.isNaN(dataNasc.getTime())) {
    return NextResponse.json({ error: 'Data de nascimento inválida', field: 'dataNascimento' }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      cpf: cpfDigits,
      telefone: onlyDigits(d.telefone),
      rg: d.rg,
      rgEmissor: d.rgEmissor || null,
      dataNascimento: dataNasc,
      pis: d.pis ? onlyDigits(d.pis) : null,
      enderecoCep: onlyDigits(d.enderecoCep),
      enderecoRua: d.enderecoRua,
      enderecoNumero: d.enderecoNumero,
      enderecoComplemento: d.enderecoComplemento || null,
      enderecoBairro: d.enderecoBairro,
      enderecoCidade: d.enderecoCidade,
      enderecoUF: d.enderecoUF.toUpperCase(),
      dadosBancariosJson: d.dadosBancarios as any,
      contatoEmergenciaNome: d.contatoEmergenciaNome,
      contatoEmergenciaTelefone: onlyDigits(d.contatoEmergenciaTelefone),
      perfilCompleto: true,
    },
  })

  return NextResponse.json({ ok: true })
}
