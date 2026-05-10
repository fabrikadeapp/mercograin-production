import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ConfiguracoesPage() {
  // Por ora a única seção de configuração é Marca/Logo.
  redirect('/configuracoes/marca')
}
