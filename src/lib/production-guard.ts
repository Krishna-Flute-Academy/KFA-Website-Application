/**
 * KFA Production Network Guard & Fail-Closed Environment Validator
 *
 * Enforces strict isolation:
 * - Production reference 'sevtycwrmhzyfxvxkkgc' is completely blocked (fail-closed).
 * - Staging reference 'hxpplzixfqhzmkhrjfba' is validated and required when targeting staging.
 * - Prevents unsafe fallbacks, credentials leakage, and unauthorized external traffic.
 */

export const FORBIDDEN_PROD_REF = 'sevtycwrmhzyfxvxkkgc';
export const FORBIDDEN_PROD_HOSTS = [
    'sevtycwrmhzyfxvxkkgc.supabase.co',
    'sevtycwrmhzyfxvxkkgc'
];

export const REQUIRED_STAGING_REF = 'hxpplzixfqhzmkhrjfba';
export const REQUIRED_STAGING_HOST = 'hxpplzixfqhzmkhrjfba.supabase.co';

export class ProductionAccessBlockedError extends Error {
    constructor(target: string, context?: string) {
        super(
            `[FAIL-CLOSED PRODUCTION GUARD] Access to production project '${FORBIDDEN_PROD_REF}' is STRICTLY FORBIDDEN! ` +
            `Target: ${target}. Context: ${context || 'unspecified'}`
        );
        this.name = 'ProductionAccessBlockedError';
    }
}

export class StagingMismatchError extends Error {
    constructor(receivedUrl: string, context?: string) {
        super(
            `[FAIL-CLOSED STAGING GUARD] Target URL does not match required staging project '${REQUIRED_STAGING_REF}'! ` +
            `Received: ${receivedUrl}. Context: ${context || 'unspecified'}`
        );
        this.name = 'StagingMismatchError';
    }
}

export class AmbiguousEnvironmentError extends Error {
    constructor(message: string) {
        super(`[AMBIGUOUS ENVIRONMENT ERROR] ${message}`);
        this.name = 'AmbiguousEnvironmentError';
    }
}

/**
 * Asserts that a given URL does NOT target production under any circumstances.
 */
export function assertNotProductionUrl(url: string | URL | null | undefined, context?: string): void {
    if (!url) return;
    const urlStr = typeof url === 'string' ? url : url.toString();
    for (const host of FORBIDDEN_PROD_HOSTS) {
        if (urlStr.includes(host)) {
            throw new ProductionAccessBlockedError(urlStr, context);
        }
    }
}

/**
 * Asserts that a given URL strictly targets staging and never production.
 */
export function assertStrictStagingUrl(url: string | URL | null | undefined, context?: string): void {
    if (!url) {
        throw new StagingMismatchError('(empty URL)', context);
    }
    const urlStr = typeof url === 'string' ? url : url.toString();
    assertNotProductionUrl(urlStr, context);
    if (!urlStr.includes(REQUIRED_STAGING_REF)) {
        throw new StagingMismatchError(urlStr, context);
    }
}

/**
 * Installs a fail-closed network interceptor on globalThis.fetch
 * Prevents any process from sending network requests to production hosts.
 */
export function installGlobalProductionNetworkGuard(options: {
    enforceStagingOnly?: boolean;
} = {}): () => void {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const urlStr = typeof input === 'string' 
            ? input 
            : ('url' in input ? input.url : input.toString());

        assertNotProductionUrl(urlStr, 'globalThis.fetch interceptor');

        if (options.enforceStagingOnly && urlStr.includes('supabase.co')) {
            assertStrictStagingUrl(urlStr, 'globalThis.fetch staging-only enforcement');
        }

        return originalFetch.call(this, input, init);
    };

    return () => {
        globalThis.fetch = originalFetch;
    };
}

/**
 * Validates that current runtime environment variables safely target staging without
 * exposing secrets or referencing production.
 */
export function validateRuntimeEnvironment(options: {
    target: 'staging' | 'local' | 'any';
    requireServiceRole?: boolean;
}): {
    supabaseUrl: string;
    authSupabaseUrl: string;
    isStaging: boolean;
} {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const authSupabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    // 1. Production reference must NEVER appear anywhere in env
    assertNotProductionUrl(supabaseUrl, 'process.env.NEXT_PUBLIC_SUPABASE_URL');
    assertNotProductionUrl(authSupabaseUrl, 'process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL');
    assertNotProductionUrl(serviceRoleKey, 'process.env.SUPABASE_SERVICE_ROLE_KEY');

    // 2. Service role key must NEVER be exposed in NEXT_PUBLIC_* variables
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('NEXT_PUBLIC_')) {
            const val = process.env[key] || '';
            if (val === serviceRoleKey && serviceRoleKey.length > 0) {
                throw new AmbiguousEnvironmentError(
                    `CRITICAL SECURITY VIOLATION: SUPABASE_SERVICE_ROLE_KEY leaked into public variable '${key}'!`
                );
            }
        }
    }

    // 3. Staging-specific checks
    if (options.target === 'staging') {
        if (!supabaseUrl) {
            throw new AmbiguousEnvironmentError('Missing NEXT_PUBLIC_SUPABASE_URL for staging target.');
        }
        if (!authSupabaseUrl) {
            throw new AmbiguousEnvironmentError('Missing NEXT_PUBLIC_AUTH_SUPABASE_URL for staging target.');
        }
        assertStrictStagingUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL validation');
        assertStrictStagingUrl(authSupabaseUrl, 'NEXT_PUBLIC_AUTH_SUPABASE_URL validation');

        if (options.requireServiceRole && !serviceRoleKey) {
            throw new AmbiguousEnvironmentError('Missing SUPABASE_SERVICE_ROLE_KEY for server-side staging execution.');
        }
    }

    return {
        supabaseUrl,
        authSupabaseUrl,
        isStaging: supabaseUrl.includes(REQUIRED_STAGING_REF)
    };
}
