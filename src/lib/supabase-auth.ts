import { createClient } from '@supabase/supabase-js';

// Initialize the secondary Supabase client designed ONLY for authentication.
// You must set these variables in your .env or .env.local file:
// NEXT_PUBLIC_AUTH_SUPABASE_URL
// NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY

const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined' && (!supabaseAuthUrl || !supabaseAuthAnonKey)) {
    console.warn('Missing Auth Supabase URL or Anon Key. Authentication will not work.');
}

// Ensure the client has access to the browser's localStorage for persisting sessions
export const supabaseAuth = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
    auth: {
        storageKey: 'kfa-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
