import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export const dynamic = 'force-dynamic'

export default async function PerfilPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const access = await db.produtorAccess.findUnique({
    where: { id: sess.accessId },
    include: { cliente: { select: { nome: true } } },
  })
  if (!access) redirect(`/portal/${params.workspaceSlug}/login`)

  const dados: Array<[string, string | null | undefined]> = [
    ['Nome completo', access.nomeCompleto],
    ['CPF / CNPJ', access.cpfCnpj],
    ['RG', access.rg],
    ['Nome do pai', access.nomePai],
    ['Nome da mãe', access.nomeMae],
    ['Profissão', access.profissao],
    ['Nacionalidade', access.nacionalidade],
    ['Cargo / função', access.cargoEmpresa],
    ['Telefone', access.telefone],
    ['WhatsApp', access.whatsapp],
    ['Email', access.emailLogin],
  ]
  const endereco = [
    access.enderecoLogradouro,
    access.enderecoNumero,
    access.enderecoComplemento,
    access.enderecoBairro,
    access.enderecoCidade && access.enderecoUf ? `${access.enderecoCidade}/${access.enderecoUf}` : access.enderecoCidade,
    access.enderecoCep ? `CEP ${access.enderecoCep}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 14, color: 'var(--portal-ink)' }}>
        Meu perfil
      </h1>
      <p style={{ color: 'var(--portal-ink-mute)', fontSize: 13, marginBottom: 16 }}>
        Dados cadastrados em <strong>{access.cliente.nome}</strong>. Estes dados são reutilizados em
        contratos e assinaturas — confirme se estão corretos.
      </p>

      <div className="portal-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0', color: 'var(--portal-ink)' }}>
          Dados pessoais
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {dados.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--portal-ink-mute)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--portal-ink)', fontWeight: value ? 500 : 400 }}>
                {value || <span style={{ color: 'var(--portal-ink-mute)' }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="portal-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px 0', color: 'var(--portal-ink)' }}>
          Endereço
        </h2>
        <div style={{ fontSize: 14, color: 'var(--portal-ink)' }}>
          {endereco || <span style={{ color: 'var(--portal-ink-mute)' }}>Sem endereço cadastrado</span>}
        </div>
      </div>

      <div className="portal-card">
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px 0', color: 'var(--portal-ink)' }}>
          Conta
        </h2>
        <div style={{ fontSize: 13, color: 'var(--portal-ink)' }}>
          Cadastrado em{' '}
          <strong>{access.createdAt ? new Date(access.createdAt).toLocaleDateString('pt-BR') : '—'}</strong>
          {access.ultimoLogin && (
            <>
              {' · '}último acesso em{' '}
              <strong>{new Date(access.ultimoLogin).toLocaleString('pt-BR')}</strong>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
