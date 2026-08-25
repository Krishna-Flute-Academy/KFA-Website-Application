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
    // Suppress the harmless but noisy "Refresh Token Not Found" unhandled rejection / console errors
    // that Supabase throws internally during autoRefreshToken race conditions or fast-refresh.
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('Refresh Token Not Found')) {
            return; // Suppress
        }
        if (args[0] && args[0].message && args[0].message.includes('Refresh Token Not Found')) {
            return; // Suppress
        }
        originalConsoleError(...args);
    };

    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && event.reason.message.includes('Refresh Token Not Found')) {
            event.preventDefault(); // Suppress the unhandled rejection
        }
    });

    // 1. Wrap getSession with error handling + in-flight deduplication + short cache.
    //    This prevents multiple simultaneous calls (e.g. from multiple components on mount)
    //    from each independently kicking off a token refresh, which causes multi-tab lock
    //    contention and "infinite loading" bugs.
    const rawGetSession = supabaseAuth.auth.getSession.bind(supabaseAuth.auth);
    let _activeSessionPromise: Promise<any> | null = null;
    let _cachedSession: any = null;
    let _cacheTime = 0;
    const SESSION_CACHE_MS = 10000; // 10 seconds — window to de-duplicate burst calls on mount and navigation

    supabaseAuth.auth.getSession = async () => {
        const now = Date.now();
        // Serve fresh cache within the window — avoids hammering on every component mount
        if (_cachedSession && (now - _cacheTime) < SESSION_CACHE_MS) {
            return _cachedSession;
        }
        // Deduplicate in-flight requests — if one is already running, share its promise
        if (_activeSessionPromise) {
            return _activeSessionPromise;
        }

        const sessionPromise = rawGetSession();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3000));

        _activeSessionPromise = Promise.race([sessionPromise, timeoutPromise]).then((response: any) => {
            _activeSessionPromise = null;
            if (response === 'TIMEOUT') {
                console.warn('KFA Auth: getSession timed out (possible lock contention). Reading from localStorage fallback.');
                if (typeof window !== 'undefined') {
                    const stored = localStorage.getItem('kfa-auth-token');
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored);
                            return { data: { session: parsed }, error: null };
                        } catch(e) {}
                    }
                }
                return { data: { session: null }, error: new Error('Session lock timeout') };
            }
            if (response.error) {
                const errMsg = response.error.message || '';
                if (
                    errMsg.includes('Refresh Token Not Found') ||
                    errMsg.includes('invalid_grant') ||
                    response.error.status === 400
                ) {
                    console.warn('KFA Auth: Stale session in getSession, clearing...');
                    localStorage.removeItem('kfa-auth-token');
                    localStorage.removeItem('kfa-user-role');
                    supabaseAuth.auth.signOut({ scope: 'local' }).catch(() => {});
                    return { data: { session: null }, error: response.error };
                }
            }
            _cachedSession = response;
            _cacheTime = Date.now();
            return response;
        }).catch((err: any) => {
            _activeSessionPromise = null;
            console.error('KFA Auth: Error in getSession wrapper:', err);
            return { data: { session: null }, error: err };
        });

        return _activeSessionPromise;
    };

    // 2. Wrap getUser with error handling for stale tokens
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
                    await supabaseAuth.auth.signOut({ scope: 'local' }).catch(() => {});
                    return { data: { user: null }, error: response.error };
                }
            }
            return response;
        } catch (err) {
            console.error('KFA Auth: Error in getUser wrapper:', err);
            return { data: { user: null }, error: err as any };
        }
    };
 
    // 2.5 Wrap signOut with error handling so it always succeeds locally
    const originalSignOut = supabaseAuth.auth.signOut.bind(supabaseAuth.auth);
    supabaseAuth.auth.signOut = async (options?: any) => {
        try {
            return await originalSignOut(options);
        } catch (err) {
            console.warn('KFA Auth: SignOut failed on server, clearing locally:', err);
            try {
                return await originalSignOut({ scope: 'local' });
            } catch (fallbackErr) {
                console.error('KFA Auth: Fallback SignOut failed:', fallbackErr);
                // Hard reset local tokens
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('kfa-auth-token');
                    localStorage.removeItem('kfa-user-role');
                    try {
                        sessionStorage.removeItem('kfa_user_session_id');
                    } catch (e) {}
                }
                return { error: fallbackErr as any };
            }
        }
    };

    // 3. Invalidate cache on any auth state change (sign-in, sign-out, token refresh).
    //    This ensures a newly logged-in user always gets a fresh session.
    supabaseAuth.auth.onAuthStateChange((event) => {
        _cachedSession = null;
        _cacheTime = 0;
        _activeSessionPromise = null;
        if (event === 'SIGNED_OUT') {
            console.log('KFA Auth: Auth state change: SIGNED_OUT. Clearing local auth storage.');
            localStorage.removeItem('kfa-auth-token');
            localStorage.removeItem('kfa-user-role');
        }
    });

    // 4. Sync session token invalidation across tabs via storage events.
    //    When another tab refreshes the token and writes to localStorage, this tab
    //    invalidates its cache so the next getSession() picks up the fresh token -
    //    preventing the "second tab infinite loading" bug.
    window.addEventListener('storage', (event) => {
        if (event.key === 'kfa-auth-token') {
            _cachedSession = null;
            _cacheTime = 0;
            _activeSessionPromise = null;
        }
    });
}
