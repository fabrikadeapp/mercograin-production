/**
 * Página pública de Romaneio — acessível sem autenticação via QR code.
 *
 * Validação:
 *  1. Token HMAC + não expirado
 *  2. tokenHash deve bater com o último gerado pra este romaneio
 *
 * Objetivo: conferente na portaria escaneia QR e visualiza dados básicos
 * sem precisar login (carga + placa + cultura + status + tickets).
 */
import { db } from '@/lib/db'
import {
  validarTokenRomaneio,
  hashTokenRomaneio,
} from '@/lib/romaneios/token'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PageProps {
  params: { token: string }
}

export default async function RomaneioPublicoPage({ params }: PageProps) {
  const { token } = params
  const v = validarTokenRomaneio(token)
  if (!v.valid || !v.romaneioId) {
    return (
      <main className="mx-auto max-w-md p-6 text-fg-1">
        <h1 className="text-xl font-bold mb-2">Link inválido</h1>
        <p className="text-fg-2">
          Este link de romaneio é inválido ou expirou. Solicite um novo QR ao
          operador.
        </p>
        {v.expirado && v.expiraEm && (
          <p className="mt-2 text-sm text-fg-3">
            Expirou em {v.expiraEm.toLocaleString('pt-BR')}.
          </p>
        )}
      </main>
    )
  }

  const hash = hashTokenRomaneio(token)
  const romaneio = await db.romaneio.findFirst({
    where: { id: v.romaneioId, qrTokenHash: hash },
    include: {
      motorista: { select: { nome: true, placa: true, cpf: true } },
      ticketsBalanca: {
        select: {
          id: true,
          numero: true,
          tipo: true,
          pesoLiquidoKg: true,
          pesoBrutoKg: true,
          status: true,
          placa: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      safra: { select: { nome: true } },
    },
  })

  if (!romaneio) return notFound()

  const totalLiquido = romaneio.ticketsBalanca.reduce(
    (s, t) => s + (t.pesoLiquidoKg || 0),
    0
  )

  return (
    <main className="mx-auto max-w-2xl p-6 text-fg-1">
      <header className="mb-6 border-b border-bg-3 pb-4">
        <p className="text-xs uppercase tracking-wider text-fg-3">
          BH Grain · Romaneio público
        </p>
        <h1 className="text-2xl font-bold mt-1">Romaneio #{romaneio.numero}</h1>
        <p className="text-sm text-fg-2 mt-1">
          Status:{' '}
          <span className="font-semibold uppercase">{romaneio.status}</span>
          {' · '}
          {romaneio.cultura}
          {romaneio.safra ? ` · ${romaneio.safra.nome}` : ''}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs text-fg-3">Origem</p>
          <p className="font-medium">{romaneio.origem}</p>
        </div>
        <div>
          <p className="text-xs text-fg-3">Destino</p>
          <p className="font-medium">{romaneio.destino}</p>
        </div>
        {romaneio.motorista && (
          <>
            <div>
              <p className="text-xs text-fg-3">Motorista</p>
              <p className="font-medium">{romaneio.motorista.nome}</p>
            </div>
            <div>
              <p className="text-xs text-fg-3">Placa</p>
              <p className="font-medium">{romaneio.motorista.placa || '—'}</p>
            </div>
          </>
        )}
        {romaneio.dataSaida && (
          <div>
            <p className="text-xs text-fg-3">Saída</p>
            <p className="font-medium">
              {new Date(romaneio.dataSaida).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
        {romaneio.dataChegada && (
          <div>
            <p className="text-xs text-fg-3">Chegada</p>
            <p className="font-medium">
              {new Date(romaneio.dataChegada).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-2">
          Tickets de balança ({romaneio.ticketsBalanca.length})
        </h2>
        {romaneio.ticketsBalanca.length === 0 ? (
          <p className="text-sm text-fg-3">Nenhum ticket vinculado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-fg-3">
              <tr>
                <th className="text-left py-1">Ticket</th>
                <th className="text-left py-1">Tipo</th>
                <th className="text-right py-1">Bruto (kg)</th>
                <th className="text-right py-1">Líquido (kg)</th>
                <th className="text-left py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {romaneio.ticketsBalanca.map((t) => (
                <tr key={t.id} className="border-t border-bg-3">
                  <td className="py-1">#{t.numero}</td>
                  <td className="py-1">{t.tipo}</td>
                  <td className="py-1 text-right">
                    {t.pesoBrutoKg.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-1 text-right">
                    {t.pesoLiquidoKg.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-1">{t.status}</td>
                </tr>
              ))}
              <tr className="border-t border-bg-3 font-semibold">
                <td colSpan={3} className="py-1 text-right">
                  Total líquido
                </td>
                <td className="py-1 text-right">
                  {totalLiquido.toLocaleString('pt-BR')} kg
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <footer className="text-xs text-fg-3 border-t border-bg-3 pt-3">
        Link válido até {v.expiraEm?.toLocaleString('pt-BR')}. Documento gerado
        automaticamente — não substitui CT-e/MDF-e.
      </footer>
    </main>
  )
}
