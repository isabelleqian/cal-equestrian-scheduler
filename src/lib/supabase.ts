import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isConfigured = Boolean(url && anonKey);
export const googleEnabled = true;

// PKCE puts the sign-in code in the query string (?code=...), which works with
// the hash-based router used for GitHub Pages.
export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, anonKey!, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (null as unknown as SupabaseClient);

/** Where Supabase sends people back after they click the email link. */
export function siteUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}
