// Supabase client initialization
// Note: the CDN script exposes `window.supabase` as the library namespace,
// so we use `sb` for our client instance to avoid the name collision.
const sb = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL
  ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY)
  : null;

const supabaseReady = !!sb;

if (!supabaseReady) {
  console.warn('Supabase not configured — set SUPABASE_URL and SUPABASE_ANON_KEY');
}
