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

export const supabaseAuth = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
    auth: {
        storageKey: 'kfa-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Robust error handling for invalid/revoked refresh tokens to prevent app loops and console clutter.
if (typeof window !== 'undefined') {
    // 1. Wrap getSession
    const originalGetSession = supabaseAuth.auth.getSession.bind(supabaseAuth.auth);
    supabaseAuth.auth.getSession = async () => {
        try {
            const response = await originalGetSession();
            if (response.error) {
                const errMsg = response.error.message || '';
                if (
                    errMsg.includes('Refresh Token Not Found') ||
                    errMsg.includes('invalid_grant') ||
                    response.error.status === 400
                ) {
                    console.warn('KFA Auth: Stale or invalid session detected in getSession, clearing local auth state...');
                    localStorage.removeItem('kfa-auth-token');
                    localStorage.removeItem('kfa-user-role');
                    await supabaseAuth.auth.signOut().catch(() => {});
                }
            }
            return response;
        } catch (err) {
            console.error('KFA Auth: Error in getSession wrapper:', err);
            return { data: { session: null }, error: err as any };
        }
    };

    // 2. Wrap getUser
    const originalGetUser = supabaseAuth.auth.getUser.bind(supabaseAuth.auth);
    supabaseAuth.auth.getUser = async (jwt?: string) => {
        try {
            const response = await originalGetUser(jwt);
            if (response.error) {
                const errMsg = response.error.message || '';
                if (
                    errMsg.includes('Refresh Token Not Found') ||
                    errMsg.includes('invalid_grant') ||
                    response.error.status === 400
                ) {
                    console.warn('KFA Auth: Stale or invalid session detected in getUser, clearing local auth state...');
                    localStorage.removeItem('kfa-auth-token');
                    localStorage.removeItem('kfa-user-role');
                    await supabaseAuth.auth.signOut().catch(() => {});
                }
            }
            return response;
        } catch (err) {
            console.error('KFA Auth: Error in getUser wrapper:', err);
            return { data: { user: null }, error: err as any };
        }
    };

    // 3. Register global onAuthStateChange backup listener
    supabaseAuth.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            console.log('KFA Auth: Auth state change: SIGNED_OUT. Clearing local auth storage.');
            localStorage.removeItem('kfa-auth-token');
            localStorage.removeItem('kfa-user-role');
        }
    });
}
