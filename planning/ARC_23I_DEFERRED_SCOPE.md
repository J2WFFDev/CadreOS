# Arc 23I — Deferred Scope

## Purpose

This document records scope items that were intentionally deferred from Arc 23I
(Entry System Consolidation & Operational Coherence) to keep the arc focused,
low-risk, and migration-safe.

Arc 23I is an integration and hardening arc. The items below were identified
during the consolidation review but excluded because they:
- require new schema migrations
- are substantial feature additions (not consistency improvements)
- carry meaningful regression risk for stable areas
- are explicitly reserved for a future arc

---

## Category 1 — Architecture & Infrastructure

### Communications Delivery
Deferred to a dedicated Communications arc.
- Email/in-app notification delivery for assignments, due-date reminders, prompt requests
- Push notification infrastructure
- Unread/seen tracking for inbox and feed items
- Delivery preference management

### Offline Sync
Deferred to a dedicated mobile/PWA arc.
- Optimistic UI with local-first mutation queue
- Conflict resolution for offline check-ins and journal drafts
- Service worker / background sync

### Advanced Audit & Export
Deferred to Admin Tools arc.
- Full audit log export (CSV/JSON)
- GDPR data export
- Retention policy enforcement

---

## Category 2 — Features & Planning Views

### Kanban / Calendar Planning Views
Deferred to Arc 24+ or a dedicated planning UI arc.
- Task board (Kanban columns by status)
- Calendar view for tasks/events with due dates
- Sprint or training block planning grid

### AI Recommendations & Automation
Deferred to a dedicated AI arc.
- Prompt suggestion from journal content
- Habit recommendation from activity patterns
- Smart follow-up generation from meeting notes

### Advanced Workflow Automation
Deferred.
- Rule-based trigger/action automation (e.g., "when task is overdue by 3 days, create follow-up")
- Scheduled recurring task generation
- Entry template library

---

## Category 3 — LiveOps / FieldOps

### LiveOps Execution Workflows
Reserved for Arc 24A — LiveOps / FieldOps Architecture.
- Session model (practice session, game, event)
- Session-scoped tasks, notes, and observations
- Real-time role assignment during live sessions
- Post-session debrief workflow

### FieldOps Enhancements
Reserved for Arc 24B+.
- Booking conflict resolution UI
- Resource allocation during sessions
- Live attendance with status propagation

---

## Category 4 — UX Consistency Improvements (deferred as low-urgency)

### FilterTabs migration for Journals and Prompts pages
Both `journals/page.tsx` and `prompts/page.tsx` still use inline filter tab markup.
They are stable and their inline markup is identical in behavior to the new `FilterTabs`
component. Migrating them is straightforward but introduces churn without functional gain.
Deferred to a future cleanup sprint.

### StatusBadge migration for remaining pages (Notes, Tasks, Follow-ups)
`notes/page.tsx`, `tasks/page.tsx`, and `follow-ups/page.tsx` use inline badge classes
that predate the new `StatusBadge` component. These pages are large (36KB–43KB) and
stable. Migrating them is additive-only but carries surface area risk for a consolidation
arc. Deferred to a future cleanup sprint.

### Habit edit / pause / archive route handlers
The Habit detail page shows Edit, Pause/Resume, and Archive buttons, but the server
route handlers for those actions are not yet implemented. This is a functional gap
but out of scope for a hardening arc. Deferred to a habit workflow completion sprint.

### formatShortDateTime migration for all pages
`lib/format-date.ts` was introduced in Arc 23I. Several pages still use
`.toISOString().slice(0, 16).replace("T", " ")` inline. Migrating all occurrences
is a low-risk cleanup; deferred to a future sprint.

---

## Category 5 — Testing

### Integration / E2E tests
Arc 23I added focused unit tests. The following integration-level tests are deferred:
- Full authorization flow tests (e.g., Playwright or Supertest for routes)
- Feed rendering integration test (with DB fixture)
- Inbox count accuracy test (with multiple entry states)
- Role-aware visibility integration test (multi-user session simulation)

### Habit completion / streak integration tests
Unit tests for streak computation are in place. Integration tests covering the
full check-in → streak → feed flow require DB fixtures and are deferred.

---

## Category 6 — EntryOps Relationship/UI Follow-ons

### Arc 24D.12 — Operational Object Linking UI Foundation
Deferred from Entry detail cleanup.
- Entry Relationships remain the single Entry-to-Entry context workflow.
- Entry-to-Person/Team/Program/Gear/Event/Facility context will move to a dedicated search/select linking UI.
- Raw target-type/target-id linking forms are intentionally removed from normal Entry detail UX.

### Arc 24D.13 — EntryOps Field-Level Audit History
Deferred from Entry detail cleanup.
- Activity/History remains available but currently summarizes changes at a high level.
- Future work will add field-level before/after details (status, priority, due date, assignee, list, etc.).

### Follow-up task UX direction
- Follow-up context should be represented through Entry relationships (e.g., `CREATED_FROM`, `FOLLOW_UP_FOR`, `RELATED_TO`).
- Any follow-up shortcut should create a normal Task and attach relationship context, not reintroduce a separate visible follow-up workflow.

---

## Arc 24 Recommendation

Based on the Arc 23I review, the platform is operationally ready to begin:

**Arc 24A — LiveOps / FieldOps Architecture and Session Model Foundation**

Recommended scope:
1. Define `Session` model (type, date, team, state)
2. Define `SessionEntry` linking entries to sessions
3. Session creation and list UI
4. Session-scoped task and note creation
5. Post-session summary view
6. Role-aware session visibility (coach vs. athlete vs. guardian)

Prerequisites satisfied:
- Entry model is stable ✅
- Activity/feed infrastructure is stable ✅
- Role-aware authorization pattern is established ✅
- Habit and Journal workflows complete ✅
- MemberOps and GearOps stable ✅
