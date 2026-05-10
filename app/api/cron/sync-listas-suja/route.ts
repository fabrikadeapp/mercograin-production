/**
 * S4 M1 — Cron de sincronização das listas oficiais de sanção.
 *
 * Trigger: Railway cron / GitHub Actions
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: 1x ao mês (listas oficiais são atualizadas trimestralmente).
 *
 * Listas:
 *   - trabalho_escravo (gov.br — Cadastro de Empregadores)
 *   - ceis/cnep/cepim  (CGU — vide lib/compliance/cgu.ts, consultas on-the-fly)
 *
 * Para MVP, este endpoint apenas registra um "stub" indicando que o
 * pipeline está pronto. Quando a fonte oficial for parseada (CSV/PDF),
 * trocar `fetchTrabalhoEscravo()` por implementação real.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface RegistroLista {
  cnpjOuCpf: string
  nome: string
  uf?: string
  municipio?: string
  detalhes?: Record<string, any>
}

async function fetchTrabalhoEscravo(): Promise<RegistroLista[]> {
  // TODO: parsear CSV oficial do gov.br ou SmartLab.
  // Por enquanto, retorna lista vazia (sem corromper estado existente).
  return []
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const inicio = Date.now()
  const stats = { trabalho_escravo: 0 }

  try {
    const registros = await fetchTrabalhoEscravo()
    if (registros.length > 0) {
      // Snapshot semântico: remove versão anterior + insere a nova.
      await db.$transaction([
        db.listaSuja.deleteMany({ where: { lista: 'trabalho_escravo' } }),
        db.listaSuja.createMany({
          data: registros.map((r) => ({
            lista: 'trabalho_escravo',
            cnpjOuCpf: r.cnpjOuCpf,
            nome: r.nome,
            uf: r.uf || null,
            municipio: r.municipio || null,
            detalhes: r.detalhes || undefined,
          })),
        }),
      ])
      stats.trabalho_escravo = registros.length
    }

    return NextResponse.json({
      ok: true,
      duracaoMs: Date.now() - inicio,
      stats,
      observacao:
        registros.length === 0
          ? 'Parser oficial ainda não implementado — lista mantida vazia.'
          : undefined,
    })
  } catch (err: any) {
    console.error('[CRON sync-listas-suja] erro:', err)
    return NextResponse.json({ error: err?.message || 'erro' }, { status: 500 })
  }
}
