# Arc 23G — Journals & Habits Views, Filters, and Readiness UX

**Status:** ✅ Complete  
**Depends on:** Arc 23A–23F  
**Next:** Arc 23H — Journals & Habits Closeout, Auth Audit, QA, Seed Data, and Documentation

---

## Goal

Arc 23G hardens operational usability for Journals & Habits without exposing protected journal content:

- role-aware operational list views
- filterable assignment/completion states
- overdue/due-soon/readiness indicators
- guardian-safe and coach-safe summary patterns
- safe navigation paths between assignments and journal/habit detail where authorized

This arc is additive and migration-safe. It does **not** introduce communications delivery, AI scoring, or destructive schema rewrites.

---

## UX Model (Operational, Privacy-Safe)

### Journals

- Journals remain reflective and sensitive.
- Broad operational lists show metadata only (title, status, visibility, source, timestamps).
- Body text remains confined to authorized detail views.
- List-level status/readiness is represented with badges, counts, and filters.

### Habits

- Habits remain recurring check-in workflows.
- Operational list views emphasize cadence, completion counts, and readiness state.
- Role-safe summaries are shown in list and guardian surfaces; completion note detail remains role-gated.

### Prompt Assignments

- Prompt assignments represent guided reflective work.
- Operational views focus on assignment state, due state, and readiness (on-track / due soon / overdue / complete).
- Prompt assignment lists avoid journal response body exposure.

---

## What Was Implemented

### 1) Journal list hardening (`/journals`)

Updated `app/(dashboard)/journals/page.tsx`:

- Added additive filters:
  - status (`active`, `archived`, `all`)
  - source (`all`, `prompted`, `freeform`)
  - athlete/author (`createdBy`)
  - team (`teamId`)
  - program (`programId`)
- Added operational summary cards:
  - draft count
  - submitted count
  - archived count
  - prompted response count
- Added list badges for:
  - source (Prompted / Freeform)
  - workflow status
- Preserved privacy: no journal body text added to broad list views.

### 2) Habit list hardening (`/habits`)

Updated `app/(dashboard)/habits/page.tsx`:

- Added additive filters:
  - status
  - athlete (`athlete`)
  - team (`teamId`)
  - program (`programId`)
  - cadence (`frequency`)
- Added operational summary cards:
  - active/paused/archived totals
  - total check-ins
- Added readiness indicator column:
  - `On track`
  - `Needs first check-in`
  - `Paused`
  - `Archived`
- Preserved privacy: no completion note detail exposed in list view.

### 3) Prompt assignment operational hardening (`/prompt-assignments`)

Updated `app/(dashboard)/prompt-assignments/page.tsx`:

- Added additive due-state filter:
  - `all`
  - `overdue`
  - `due_soon`
  - `no_due`
- Added staff-only scope filters:
  - athlete
  - team
  - program
- Added summary cards:
  - open
  - closed
  - overdue
  - due soon
- Added readiness column:
  - `At risk`
  - `Due soon`
  - `On track`
  - `Complete`
- Guardian-safe UX hardening:
  - Guardian list rows no longer link into prompt-library detail route.

### 4) Operational navigation improvements

Updated `components/nav-sidebar.tsx`:

- Added dedicated links for:
  - Prompt Assignments
  - Habits
  - Guardian Summary

This improves discoverability of Arc 23 operational surfaces for role-based workflows.

---

## Privacy and Authorization Notes

Arc 23G keeps Arc 23A–23F boundaries intact:

- No journal body previews were introduced in broad lists, summary cards, counts, feeds, or filters.
- All list-level records remain backed by existing role/relationship authorization checks.
- Guardian scope remains relationship-scoped and summary-first.
- Coach/staff views remain operational and scoped, not broad private-content views.

---

## Dashboard / Feed / Today-Upcoming Posture

- Feed remains safe-summary-first and does not expose journal body text.
- Arc 23G improvements focus on Journals, Habits, Prompt Assignments, and navigation UX.
- Today/Upcoming and dashboard deeper cross-surface synthesis is intentionally kept additive for Arc 23H closeout validation.

---

## Deferred Scope (Explicitly Not Included)

- AI readiness scoring
- Coach review workflow engines
- advanced analytics/export
- trend analysis and cohort benchmarking
- gamification systems
- push/email/SMS reminder delivery
- custom dashboard builders
- offline journaling/habits sync
- wearable/device integrations

---

## Acceptance Snapshot

- ✅ Operational Journals/Habits views are filterable and role-aware.
- ✅ Prompt assignment readiness and overdue state are visible without body-text leakage.
- ✅ Guardian-safe and coach-safe summary patterns are preserved.
- ✅ Changes are additive and migration-safe.
- ✅ Arc 23H is now the recommended next arc.

---

## Recommended Next Arc

**Arc 23H — Journals & Habits Closeout, Auth Audit, QA, Seed Data, and Documentation**

Suggested Arc 23H closeout focus:

- auth visibility audit across all Arc 23 routes
- end-to-end manual QA completion and sign-off
- seed-data strengthening for role/scoping scenarios
- regression coverage expansion for filters and privacy leakage prevention
- final Arc 23 documentation consolidation
