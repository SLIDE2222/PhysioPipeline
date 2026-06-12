(function () {
  const SUPABASE_URL =
    window.PHYSIO_SUPABASE_URL ||
    'https://epptihpvgwzrodfsukpr.supabase.co';
  const SUPABASE_ANON_KEY =
    window.PHYSIO_SUPABASE_ANON_KEY ||
    'sb_publishable_QNqv1waCxDu2z2vprYM62w_zkhrafGH';

  function initializeSupabaseClient() {
    console.log('Supabase library:', window.supabase);

    if (!window.supabase?.createClient) {
      console.error('Supabase library is not loaded before supabase-client.js.');
      return null;
    }

    if (window.supabaseClient?.auth) {
      console.log('Supabase client:', window.supabaseClient);
      console.log('Google OAuth client auth:', window.supabaseClient.auth);
      return window.supabaseClient;
    }

    const supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    // Keep the CDN library on window.supabase. Auth code should use only this
    // initialized app client so window.supabase is never overwritten.
    window.supabaseClient = supabaseClient;

    console.log('Supabase client:', window.supabaseClient);
    console.log('Google OAuth client auth:', window.supabaseClient?.auth);

    return supabaseClient;
  }

  window.initializePhysioSupabaseClient = initializeSupabaseClient;
  initializeSupabaseClient();
})();
