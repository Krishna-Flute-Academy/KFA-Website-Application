# KFA EMERGENCY ROLLBACK RUNBOOK
## Production Rollback & Disaster Recovery Specification

**Target System:** Krishna Flute Academy Production  
**Production Supabase Reference:** `sevtycwrmhzyfxvxkkgc`  
**Production Web Application:** `https://krishnafluteacademy.com`  
**Current Baseline Commit:** `2186578` (`origin/main`)  
**Verified Production Deployment Edge ID:** `bom1::iad1::ljclw-1793631501275-049b961fc194`  
**Pre-Release Verified Backup Directory:** `migration-backups/prod_20261102_210438`  
**Verified Full PostgreSQL Dump:** `production_full_custom_20261102_210438.dump` (SHA-256: `1e06e0871f3c744766bf7449fc69c73bf54673c68df8eb04a29a5952dbd33b4d`)

---

### 1. Application-Level Rollback (Instant & Zero-Data-Loss)

Because all 18 database migrations are strictly additive (new tables, new audit logs, new non-breaking columns with defaults), **the previous application version (`2186578`) is 100% forward-compatible with the new schema**.

#### Option A: Vercel Dashboard Instant Rollback (Recommended — < 30 seconds)
1. Open [Vercel Dashboard](https://vercel.com) $\rightarrow$ Navigate to `Krishna-Flute-Academy/KFA-Website-Application`.
2. Click **Deployments**.
3. Locate the previous production deployment associated with commit `2186578` (Edge ID prefix: `ljclw-1793631501275`).
4. Click the **three dots (...)** next to that deployment and select **Instant Rollback / Promote to Production**.
5. The edge routing immediately flips traffic back to the previous deployment. No rebuild or database alteration required.

#### Option B: Git Revert & Fast-Forward Push
If deploying via GitHub Git integration:
```bash
git checkout main
git reset --hard 2186578
git push origin main --force-with-lease
```
Vercel will detect the push and redeploy commit `2186578` automatically.

---

### 2. Database Recovery Procedure (Only If Catastrophic Schema Corruption Occurs)

> [!CAUTION]
> **DESTRUCTIVE RESTORE RULE:**
> Under academy safety policy, **never automatically restore a database dump into production** without explicit Owner authorization. A database restore will overwrite transactions created after the backup timestamp (`2026-11-02 21:04:38 IST`).

#### Pre-Restore Write Freeze (Stopping all mutations):
1. In Vercel Project Settings, enable Maintenance Mode or set `BLOCK_PRODUCTION=true`.
2. If necessary, revoke API keys or disable Realtime in Supabase Dashboard (`sevtycwrmhzyfxvxkkgc` $\rightarrow$ Settings $\rightarrow$ API).

#### Database Restore Execution (Owner-Approved):
The full custom dump is stored locally at:
`migration-backups/prod_20261102_210438/production_full_custom_20261102_210438.dump`

To restore via pg_restore to production `sevtycwrmhzyfxvxkkgc`:
```bash
# Retrieve production database connection string or run via Supabase CLI
/opt/homebrew/Cellar/libpq/18.6_1/bin/pg_restore \
  -h db.sevtycwrmhzyfxvxkkgc.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  migration-backups/prod_20261102_210438/production_full_custom_20261102_210438.dump
```

#### Preserving Legitimate Post-Backup Transactions:
If students paid fees or marked attendance between the backup point and the rollback point:
1. Export newly created rows from production before restore:
   ```sql
   COPY (SELECT * FROM public.fees_payments WHERE created_at > '2026-11-02 21:04:38+05:30') TO STDOUT WITH CSV HEADER;
   COPY (SELECT * FROM public.attendance WHERE created_at > '2026-11-02 21:04:38+05:30') TO STDOUT WITH CSV HEADER;
   ```
2. Re-apply the exported transactions after the database restore.

---

### 3. Verification Following Rollback
1. Test Public Home Page: `curl -I https://krishnafluteacademy.com` $\rightarrow$ Expect `HTTP/2 200`.
2. Verify Student Dashboard login: `/login` $\rightarrow$ `/student-dashboard`.
3. Verify Teacher Dashboard login: `/login` $\rightarrow$ `/teacher-dashboard`.
4. Check that existing balances and attendance counts match the pre-cutover baseline:
   - Users: 96
   - Students: 86
   - Attendance: 812
   - Payments: 202
   - Total Credits Sum: 182
