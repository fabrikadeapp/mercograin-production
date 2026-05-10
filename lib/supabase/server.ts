/**
 * Supabase admin client (server-only).
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY — NUNCA importar este módulo em código que possa
 * rodar no client (componentes 'use client', etc). Restrito a route handlers,
 * server components e scripts.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'
    )
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export const SUPABASE_BUCKET =
  process.env.SUPABASE_BUCKET_UPLOADS || 'phb-grain-uploads'
