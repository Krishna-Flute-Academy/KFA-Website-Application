-- ============================================================
-- KFA Website — Database Health Audit Query
-- ============================================================
-- Run this ENTIRE script in:
--   Supabase Dashboard → SQL Editor → New Query → Run
--
-- It produces 6 diagnostic result sets.
-- Scroll through the results to see all findings.
-- ============================================================


-- ── SECTION 1: Missing Indexes on Foreign Key Columns ───────
-- These cause Postgres to do a full table scan on every JOIN,
-- DELETE CASCADE, and RLS policy evaluation.
-- Every FK column that lacks an index is burning your Disk I/O budget.

SELECT
  '1. MISSING FK INDEXES' AS section,
  tc.table_name,
  kcu.column_name AS fk_column,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  '⚠ ADD: CREATE INDEX ON public.' || tc.table_name || '(' || kcu.column_name || ');' AS fix_sql
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = tc.table_name
      AND a.attname = kcu.column_name
  )
ORDER BY tc.table_name, kcu.column_name;


-- ── SECTION 2: Tables WITHOUT RLS Enabled ───────────────────
-- Any table without RLS in the public schema is fully readable
-- by anyone with the anon key. This is a security vulnerability.

SELECT
  '2. TABLES WITHOUT RLS' AS section,
  schemaname,
  tablename,
  '⚠ SECURITY RISK — ADD: ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' AS fix_sql
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity = true
  )
ORDER BY tablename;


-- ── SECTION 3: RLS Policies Using Deprecated auth.role() ────
-- auth.role() is deprecated and BROKEN when anonymous sign-ins
-- are enabled. These policies silently allow wrong access.

SELECT
  '3. DEPRECATED auth.role() IN POLICIES' AS section,
  schemaname,
  tablename,
  policyname,
  '⚠ Replace auth.role() with TO authenticated clause' AS issue,
  qual AS policy_definition
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.role()%' OR with_check LIKE '%auth.role()%')
ORDER BY tablename;


-- ── SECTION 4: Top 15 Slowest / Most Expensive Queries ───────
-- These are your biggest Disk I/O consumers right now.
-- Requires pg_stat_statements extension (enabled by default on Supabase).

SELECT
  '4. TOP EXPENSIVE QUERIES' AS section,
  ROUND(total_exec_time::numeric, 2)                         AS total_ms,
  calls,
  ROUND(mean_exec_time::numeric, 2)                          AS avg_ms,
  ROUND((shared_blks_read + shared_blks_written)::numeric, 0) AS total_disk_blocks,
  LEFT(query, 200)                                            AS query_preview
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY (shared_blks_read + shared_blks_written) DESC
LIMIT 15;


-- ── SECTION 5: Tables with High Row Counts (bloat check) ─────
-- Tables with very high live + dead tuple ratios need VACUUM.
-- Dead tuples bloat table size and cause extra Disk I/O.

SELECT
  '5. TABLE BLOAT / VACUUM STATUS' AS section,
  schemaname,
  relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  CASE
    WHEN n_live_tup > 0
    THEN ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 1)
    ELSE 0
  END AS dead_pct,
  last_autovacuum,
  last_autoanalyze,
  CASE
    WHEN n_dead_tup > 1000 AND (n_dead_tup::float / NULLIF(n_live_tup,0)) > 0.2
    THEN '⚠ VACUUM NEEDED: VACUUM ANALYZE public.' || relname || ';'
    ELSE '✓ OK'
  END AS recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY dead_rows DESC;


-- ── SECTION 6: Realtime Publication Tables ───────────────────
-- Every table in supabase_realtime publication costs resources.
-- Only tables that actually need live updates should be there.

SELECT
  '6. REALTIME PUBLICATION TABLES' AS section,
  schemaname,
  tablename,
  '⚠ Verify this table needs Realtime — remove if not required' AS note
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
