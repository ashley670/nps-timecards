import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser (client) components.
 * Uses @supabase/ssr's createBrowserClient which handles cookie-based
 * auth automatically in the browser context.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
