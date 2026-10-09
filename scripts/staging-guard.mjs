/**
 * KFA Staging Environment Isolation Guard
 * 
 * Strict safeguard ensuring that destructive test, staging migration, 
 * or staging seeding operations can NEVER execute against production databases.
 */

export const STAGING_PROJECT_REF = 'hxpplzixfqhzmkhrjfba';
export const BLOCKED_PRODUCTION_REFS = Object.freeze([
    'sevtycwrmhzyfxvxkkgc', // Production Academy DB
    'cmjyqvyzxthnjnuxbufz'  // Production Public Content DB
]);

export function assertStagingRef(targetRef) {
    if (!targetRef) {
        throw new Error('[StagingGuard] FATAL: No project reference specified.');
    }
    const cleanRef = targetRef.trim().toLowerCase();
    if (BLOCKED_PRODUCTION_REFS.includes(cleanRef)) {
        throw new Error(
            `[StagingGuard] FATAL SAFETY VIOLATION: Blocked operation against production database '${cleanRef}'.`
        );
    }
    if (cleanRef !== STAGING_PROJECT_REF) {
        throw new Error(
            `[StagingGuard] FATAL: Target project '${cleanRef}' does not match staging ref '${STAGING_PROJECT_REF}'.`
        );
    }
    return true;
}
