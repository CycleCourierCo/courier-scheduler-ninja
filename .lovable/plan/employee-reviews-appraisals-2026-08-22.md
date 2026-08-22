# Employee Reviews & Appraisals

A structured performance review system for internal staff: manual scheduling, self-assessment, manager assessment, role-specific competencies, agreed actions, employee sign-off, and historical trend charts.

## Review lifecycle

```text
Draft -> Self-assessment -> Manager assessment -> Review meeting
      -> Agreed objectives -> Employee response -> Signed off (locked)
```

Each stage is stamped with who completed it and when, so a review becomes an audit trail rather than a form.

## What a review contains

- **Header**: employee, job role(s), manager/reviewer, review type (probation, monthly, quarterly, 6-month, annual, ad-hoc), review period start/end, review date.
- **Previous review recap**: last overall score, last review date, previous objectives and whether they were completed.
- **Self-assessment**: 1-5 self ratings on the same competencies plus free-text (what went well, struggles, obstacles, proudest achievement, satisfaction, support needed, training wanted).
- **Manager assessment**: 1-5 ratings on core competencies + role competencies, each with an evidence/comment box. A comment is **required** for any 1, 2, 4 or 5; optional for 3.
- **Scoring split**: Performance (role KPIs/competencies) weighted 70%, Behaviour & culture weighted 30%. Overall score is the weighted average, shown alongside the employee's self-score.
- **Objectives & actions**: action, owner (employee/manager), due date, status (not started / in progress / complete).
- **Employee response**: agree / agree with comments / disagree, comments, optional request for further discussion, then acknowledgement.
- **Sign-off**: locks the review read-only; only an admin can reopen.

## Competency sets

- **Core (everyone)**: reliability, professionalism, teamwork, communication, ownership, attitude, safety mindset, respect for customers and colleagues, quality of work, attendance and timekeeping.
- **Role-specific**, driven by the roles the user already has: driver (safe driving, vehicle checks, delivery quality, timeslot adherence, fuel/route discipline), mechanic (workshop quality, inspection accuracy, throughput vs book time, tidiness), loader (loading accuracy, storage/bay discipline, damage prevention), route planner (route quality, utilisation, responsiveness to changes), customer service (response quality, tone, resolution), fleet manager, sales, tech.

Role competency questions come from a config file so they can be extended without a migration. Ratings are stored per competency key, so charts can trend any single competency over time.

## Pages and access

- `/reviews` (Admin section, new menu entry): admin/manager list of all reviews with filters (employee, role, review type, stage, date range), plus a "New review" dialog to pick employee, reviewer, type and period. Manual scheduling only.
- `/reviews/:id`: the review itself, rendered stage-by-stage. The visible/editable sections depend on who is viewing and the current stage.
- `/my-reviews`: an employee's own reviews. They can complete their self-assessment, read the submitted manager assessment, respond and acknowledge. Their own reviews only.
- **Employee history**: on both the admin review page and `/my-reviews`, a history table (period, overall, self score, manager score) and line charts for overall plus each competency category, so you see trajectory rather than isolated snapshots.

## Technical notes

**New tables (public schema, RLS enabled, explicit GRANTs):**

- `review_cycles` — one row per review: `employee_id`, `reviewer_id`, `review_type`, `period_start`, `period_end`, `review_date`, `stage`, `overall_score`, `self_overall_score`, `performance_score`, `behaviour_score`, meeting notes, stage timestamps, `signed_off_at`.
- `review_ratings` — `cycle_id`, `competency_key`, `category` (performance | behaviour), `source` (self | manager), `score` 1-5, `comment`. Validation trigger enforces a non-empty comment for manager scores of 1, 2, 4, 5.
- `review_responses` — self-assessment and employee-response free-text answers keyed by `question_key`.
- `review_actions` — `cycle_id`, `description`, `owner` (employee | manager), `due_date`, `status`, `completed_at`.

**RLS model:**

- Admin: full access via `is_admin()`.
- Reviewer: read/write on cycles where `reviewer_id = auth.uid()`, blocked once `stage = 'signed_off'`.
- Employee: read own cycles once the self-assessment stage has opened; write only their self-assessment rows (`source = 'self'`) and their response rows, and only while the matching stage is active.
- No `anon` grants anywhere.

**Frontend:**

- `src/config/reviewCompetencies.ts` — core + role competency definitions and self-assessment/response question sets.
- `src/services/reviewService.ts` — CRUD, stage transitions, score computation (70/30 weighting), history aggregation.
- `src/hooks/useReviews.ts` — react-query hooks.
- `src/pages/ReviewsPage.tsx`, `src/pages/ReviewDetailPage.tsx`, `src/pages/MyReviewsPage.tsx` plus components under `src/components/reviews/` (stage stepper, rating grid with mandatory-comment enforcement, actions table, history charts).
- Registered in `src/config/routes.ts`: `reviews` (admin/manager, Admin section) and `my-reviews` (all internal staff, Admin section), wired into `src/App.tsx`. Both hidden from b2b/b2c customers.
- Scores and stage transitions are computed server-side in the service layer from stored ratings, never trusted from the client.

Not included in this build: automated KPI pull from operational data (timeslips, inspections, fuel, dispatch). The schema leaves room for it — role KPI competencies can later be auto-populated instead of manually rated. Reminders/notifications are also out of scope since scheduling is manual.