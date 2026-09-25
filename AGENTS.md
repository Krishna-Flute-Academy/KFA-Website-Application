# Krishna Flute Academy — Agent Guide

## Architecture

- Next.js 16 App Router, React 19, TypeScript (non-strict), Tailwind, and PWA support.
- Public pages cover marketing, courses, blog, gallery, inquiries, and practice tools. Authenticated portals are `/student-dashboard` and `/teacher-dashboard`; `/admin-dashboard/*` rewrites to the teacher dashboard.
- The UI is client-heavy. Keep data access and authorization behavior consistent with existing components and database RLS.

## Supabase and Authentication

- `src/lib/supabase-auth.ts` is the authenticated academy client. It persists the `kfa-auth-token` session and is used for protected academy data.
- `src/lib/supabase.ts` is the separate public/content client, with session persistence disabled. Do not substitute one client for the other without tracing the access model.
- Roles: `admin`, `teacher`, `student`, `mentor`, and `pending`. Statuses: `active`, `inactive` (learning paused), and `archived` (former student). Central lifecycle rules live in `src/lib/student-lifecycle.ts`.
- Paused/archived students retain limited curriculum/history access but cannot participate in operational classroom, live-class, task, leave, fee, or notification flows. Practice-tool access remains available.

## Academy Domain Model

- `classrooms` is the canonical classroom entity. Permanent rosters use `classroom_students`; recurring timing uses `batch_schedules`.
- A special/makeup session creates a temporary shadow `classrooms` row plus `temporary_classes`. `session_student_overrides` is its authoritative roster and also represents date-specific makeup attendance for permanent rooms. Use `src/lib/classroom-participants.ts` to resolve effective participants.
- Attendance combines `attendance`, `leave_requests`, classroom/session data, and fee credit logic. `attendance.on_behalf_of_date` may represent another scheduled class/date; preserve this behavior. Do **not** reintroduce the previously considered Rolling 4-Class Entitlement Model.
- Fees support monthly and per-class billing. `fees_payments`, attendance, leave/overrides, and `fees_classes_paid` are coupled; trace `src/lib/fee-utils.ts` and related triggers before changing them.
- Curriculum is categories → modules → chapters → lessons. `classroom_inventory_allocation` grants classroom or student-specific access; `student_topic_progress` tracks progress and `student_curriculum_spotlights` provides targeted highlights.
- Assignments use `assignments`, `assignment_students`, and `assignment_attachments`. Student recording uploads use authenticated Google Drive routes and are linked back to assignment state.

## Community

- Community identities live in `community_profiles`, separate from academy `users`, so external members gain no academy access.
- Community tables cover categories, posts, replies, reactions, and reports; scopes are `public`, `students`, and `classroom`.
- Preserve database-enforced authorship/moderation rules: authors edit their content; admins moderate/soft-delete but must not rewrite others' content.

## Security and Database Rules

- RLS is the authorization boundary. Never weaken it just to make a feature work; investigate policies, helper functions, and the caller's authenticated context.
- Never expose service-role credentials to client code. Treat `SECURITY DEFINER` functions, storage policies, and RPC grants as privileged surfaces.
- Never perform destructive production database work without explicit approval.
- The migration directory is not a fully trustworthy standalone baseline: foundational schema pre-dates tracked migrations, some versions are duplicate/nonstandard, and `full_database_setup.sql` is only a partial public-content bootstrap. Confirm live migration history/schema before database work.
- Never delete or rewrite historical migrations to fix a current schema issue. Prefer a new migration, and clearly explain its changes.

## Development Rules

1. Prefer minimum targeted changes over large refactors.
2. Never modify unrelated functionality while fixing an issue.
3. Investigate the existing implementation before changing it.
4. Preserve existing business behavior unless the task explicitly asks to change it.
5. Before modifying attendance, fees, class credits, special sessions, or student lifecycle logic, trace related dependencies first.
6. After implementation, run the smallest relevant validation first rather than every test.
7. Report files changed, database changes, tests/checks performed, and remaining risks.
8. Do not deploy to production unless explicitly instructed.

## Commands

- `npm run dev` — development server.
- `npm run lint` — configured lint command (`next lint`).
- `npx tsc --noEmit` — type check; no dedicated package script exists.
- `npm test` — Node unit tests matching `tests/*.test.mjs` only.
- `npm run test:e2e` — Playwright tests (starts/reuses the dev server).
- `npm run build` — production build; `npm start` — production server.

