import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the service role key.
 * This client BYPASSES Row Level Security (RLS) and has full database access.
 *
 * IMPORTANT: Only use this client in trusted server-side contexts
 * (Server Actions, Route Handlers, cron jobs, scripts).
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable automatic token refresh — admin key doesn't expire
      autoRefreshToken: false,
      // Don't persist session in storage on server
      persistSession: false,
    },
  })
}
