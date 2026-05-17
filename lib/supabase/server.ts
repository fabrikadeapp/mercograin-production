/**
 * @deprecated Storage migrado para Railway Volume.
 *
 * Mantemos apenas SUPABASE_BUCKET (string usada como nome do diretório no
 * volume) e um getSupabaseAdmin() que joga erro pra detectar imports antigos.
 */

export const SUPABASE_BUCKET =
  process.env.SUPABASE_BUCKET_UPLOADS || 'phb-grain-uploads'

export function getSupabaseAdmin(): never {
  throw new Error(
    'getSupabaseAdmin() não disponível — Storage migrado para Railway Volume. ' +
      'Use @/lib/storage/local em vez disso.',
  )
}
