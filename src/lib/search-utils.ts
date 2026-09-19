/**
 * Search Utilities for KFA Platform
 * 
 * Provides robust, token-based, order-independent, case-insensitive,
 * diacritic-insensitive, and whitespace-normalized search matching across
 * multiple entity fields.
 */

/**
 * Normalizes text for search indexing and comparison:
 * - Gracefully handles null/undefined/numbers
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 * - Normalizes and removes diacritics / accent marks (e.g. é -> e, ö -> o)
 * - Collapses multiple consecutive whitespace characters into a single space
 */
export function normalizeSearchText(text: string | null | undefined | number): string {
    if (text === null || text === undefined) return '';
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extracts non-empty, normalized search tokens from a raw query string.
 * Splits on whitespace after normalization so multi-word phrases become individual tokens.
 */
export function getSearchTokens(searchQuery: string | null | undefined): string[] {
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
}

/**
 * Evaluates whether a set of searchable fields matches all tokens of a search query.
 * 
 * Rules:
 * 1. If searchQuery is empty/whitespace-only, returns true (all items match empty query).
 * 2. Order-independent: tokens can appear in any order.
 * 3. Multi-word: EVERY token must be matched in AT LEAST ONE searchable field.
 * 4. Partial matching: tokens match substrings within the field.
 * 5. Case-, whitespace-, and diacritic-insensitive.
 * 
 * @param searchableFields Array of candidate fields (e.g. title, description, category, name, email)
 * @param searchQuery The raw query string entered by the user
 */
export function matchesSearchTokens(
    searchableFields: (string | null | undefined | number)[],
    searchQuery: string | null | undefined
): boolean {
    const tokens = getSearchTokens(searchQuery);
    if (tokens.length === 0) return true;

    // Pre-normalize all candidate fields
    const normalizedFields = searchableFields
        .map(field => normalizeSearchText(field))
        .filter(field => field.length > 0);

    if (normalizedFields.length === 0) return false;

    // Every search token must match at least one normalized field
    return tokens.every(token =>
        normalizedFields.some(field => field.includes(token))
    );
}
