# CadreOS Build Readiness Review

## 1. Executive Summary
CadreOS is close to build-ready for an MVP kickoff, but not fully ready yet. Product direction is strong and coach-centered, yet key implementation-enabling artifacts are still missing or fragmented (API contract, full acceptance criteria coverage, and Prisma-ready schema depth). Recommendation: proceed to app foundation only after this review’s must-decide items are resolved and the missing planning docs are added.

## 2. Current Documentation Assessment
| File | Purpose | Quality | Gaps / Actions |
| --- | --- | --- | --- |
| `planning/README.md` | Planning index and top-level framing | Good | Update links to include this review and any new canonical docs. |
| `planning/PRODUCT_VISION.md` | Vision, users, outcomes, principles | Good | Broad target set; tighten MVP primary user persona hierarchy. |
| `planning/PRD.md` | MVP objective, requirements, metrics, out-of-scope | Good | Includes “reliable notifications” and analytics without implementation constraints; needs stricter MVP boundaries and acceptance criteria references. |
| `planning/FEATURE_BREAKDOWN.md` | Capability map across product surface | Mixed | Useful long-term map, but mixes MVP and later-stage features; needs tier tags (MVP/Phase 2+). |
| `planning/DOMAIN_MODEL.md` | Initial entity and relationship map | Mixed | Includes many non-MVP entities; needs canonical MVP entity set and relationship rules by scope. |
| `planning/DATA_MODEL.md` | Prisma-style starter schema fragment | Early draft | Only `Organization`, `Program`, `Person`; missing core MVP models, constraints, indexes, and tenancy scoping. |
| `planning/ROADMAP.md` | Milestone-level roadmap and MVP exit criteria | Good | Sequence is useful; add implementation-ready deliverables and phase gates. |
| `planning/USER_STORIES.md` | MVP epics/stories + suggested issue order | Good | No complete acceptance criteria set per story; story dependencies need explicit mapping. |
| `planning/MVP_SPEC.md` | MVP goal, roles, modules, non-MVP list | Good | Role definitions are present but permission boundaries need sharper detail. |
| `planning/PERMISSIONS_MATRIX.md` | Permission sensitivity callout + sample table | Incomplete | Critical but currently illustrative only; requires full action/resource matrix and scope rules. |
| `planning/SCREEN_INVENTORY.md` | Initial screen list | Early draft | Missing navigation structure, role-specific entry points, and screen-level acceptance criteria. |
| `planning/CHAT_TRANSCRIPT.md` | Discovery/session history and rationale context | Contextual | Keep for traceability; not a build-spec source. |
| `planning/Some tech stack thoughts` *(verified current non-standard filename)* | Early stack option notes | Useful but outdated | Replace SQLite/MySQL branch with canonical Postgres/Neon + Next.js stack decision record; rename to `planning/TECH_STACK_DECISIONS.md`. |
| `planning/Strengthen User Stories with Acceptance Criteria` *(verified current non-standard filename)* | Example story with AC pattern | Useful seed | Convert into standardized template and apply to all MVP stories; rename to `planning/USER_STORY_AC_TEMPLATE.md`. |
| `planning/planning/MILESTONE_1_FOUNDATION_OS.md` *(current nested location)* | Early milestone scratch notes | Useful seed | Move/merge into canonical roadmap/implementation-sequence docs and relocate to `planning/MILESTONE_1_FOUNDATION_OS.md` if retained. |

### Missing expected planning files
- `planning/API_CONTRACT.md` (missing) — **create now**.
- `planning/ACCEPTANCE_CRITERIA.md` (missing) — **create now** or integrate a structured AC section into each story/spec.
- `planning/PRISMA_MODEL_DRAFT.md` (missing) — **create now** using MVP-only entities first.

## 3. Product Definition Check
### Target users
- Coaches (primary daily operators)
- Program staff/directors/admins (program governance/operators)
- Parents/guardians (availability, visibility, follow-up participation)
- Athletes (availability/self-view in scoped contexts)

### Primary buyer/user
- Primary buyer: Program leadership (director/admin)
- Primary product user for MVP: Coaches and operations staff

### MVP user roles
- Organization Admin
- Program Director
- Coach
- Assistant Coach
- Parent/Guardian
- Athlete

### Core MVP workflows
- People and role onboarding
- Parent/guardian-athlete relationship linking
- Team/season/roster management
- Coach note/observation capture
- Event creation and publishing
- RSVP/availability collection
- Attendance recording
- Follow-up task creation and completion
- Audit history visibility for key actions

### Explicit out-of-scope items (MVP)
- Advanced AI/recommendation systems
- Payments/finance depth
- Inventory management
- Health/medical records
- Full messaging/chat platform
- Deep analytics/business intelligence
- Complex third-party integrations

## 4. Terminology Alignment
Use these canonical terms across all planning docs:
- **Athlete** (not player)
- **Parent/Guardian** (single combined label, with relationship type value)
- **Coach** and **Program Staff** (avoid generic “staff” when coach-specific)
- **Organization** (top-level owner) and **Program** (sub-unit)
- **Event** as umbrella, with `eventType` values: practice, game, match, meeting, travel
- **Observation Note** (instead of mixed “note/observation” wording)
- **Follow-up Task** (instead of mixed “task/follow-up” wording)

## 5. MVP Scope Recommendation
### Must-have
- Auth + role-based access with scope boundaries
- Organization/program/team/season/roster model
- People profiles + guardian relationships
- Observation Notes with linked context (athlete/team/event)
- Event scheduling + RSVP/availability
- Attendance capture + status reasons
- Follow-up Tasks linked to source records
- Immutable audit event logging for critical operations

### Should-have (if time permits in MVP)
- Basic dashboard cards (today’s events, pending RSVPs, overdue tasks)
- Lightweight notification triggers (in-app state cues, not full messaging system)
- CSV import for people/rosters (single template)

### Later features
- Development plans/goals
- Compliance/forms/consents
- Inventory/assets
- Expanded reporting suites
- Automation/recommendation layer

### Explicit non-MVP
- Payments, billing, invoicing
- Full chat/messaging infrastructure
- Advanced analytics and forecasting
- Medical/health records
- Multi-system deep integrations

## 6. Suggested Tech Stack
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js server actions + route handlers (hybrid by use case)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Database hosting:** Neon
- **Hosting:** Vercel
- **Authentication recommendation:** Clerk or Auth.js
  - Clerk: fastest setup, polished org/user flows, vendor lock-in and cost considerations.
  - Auth.js: more control and portability, but more implementation effort and auth edge-case ownership.
  - MVP recommendation: Clerk for speed, revisit later if cost/control needs change.
- **Validation:** Zod for schema validation at API/server-action boundaries
- **Testing (minimum viable):**
  - Unit: Vitest for domain/service logic
  - Integration: Prisma + test DB flows for critical CRUD/permission paths
  - E2E smoke: Playwright for login, roster, notes, event, attendance happy paths
- **CI/CD:** GitHub Actions (typecheck, lint, test) + Vercel preview deployments per PR

### Stack risks
- Server actions can drift into hidden coupling; enforce service-layer boundaries.
- Prisma migration discipline is required early to avoid schema churn.
- Neon connection limits require proper pooling strategy.
- Auth provider choice affects future portability and tenancy design.

## 7. Proposed App Architecture
### Folder structure (initial)
- `app/` (routes, layouts, server components)
- `app/(dashboard)/...` (role-authenticated app sections)
- `app/api/...` (webhook/integration and non-server-action endpoints)
- `components/` (shared UI components)
- `features/people|teams|notes|events|attendance|tasks/` (domain modules)
- `lib/auth/`, `lib/db/`, `lib/permissions/`, `lib/audit/`, `lib/validation/`
- `prisma/schema.prisma` + migrations
- `tests/unit`, `tests/integration`, `tests/e2e`

### Route structure
- `/dashboard`
- `/people`, `/people/[personId]`
- `/teams`, `/teams/[teamId]`
- `/events`, `/events/[eventId]`
- `/attendance/[eventId]`
- `/tasks`, `/tasks/[taskId]`
- `/admin/roles-permissions`, `/admin/audit`

### API/server action pattern
- Server actions for form-driven internal operations.
- Route handlers for integration/webhook and externally callable endpoints.
- All writes funnel through feature service functions with centralized authorization + audit emission.

### Database/Prisma structure
- Single `schema.prisma` with explicit tenancy keys (`organizationId`, optional `programId`) on scoped entities.
- Enum-backed status fields for RSVP, attendance, task lifecycle.
- Soft deletion only where required; audit log remains immutable.

### Component organization
- Shared design primitives in `components/ui`.
- Feature-specific UI and forms colocated in `features/*/components`.
- Permission-aware rendering via server-validated capabilities, not client-only checks.

### Environment variables (minimum)
- `DATABASE_URL`
- `DIRECT_URL` (for Prisma migrations, if needed)
- `AUTH_*` (provider keys/secrets)
- `NEXT_PUBLIC_APP_URL`
- `AUDIT_LOG_RETENTION_DAYS` (optional, policy-driven)

### Deployment assumptions
- Vercel-managed deploys per branch/PR.
- Neon Postgres with separate dev/preview/prod databases.
- Prisma migrations run in CI/deploy pipeline with controlled promotion.

## 8. Data Model Review
### Missing MVP entities/structures
- `UserAccount` + auth provider linkage
- `Membership`/`RoleAssignment` with org/program/team scope
- `AthleteGuardianRelationship` with relationship type + custody/visibility flags
- `RosterMembership` (team-season-person join)
- `EventParticipant` or equivalent join for RSVP/attendance coherence
- `TaskSource` polymorphic reference strategy

### Unnecessary-for-MVP entities (defer)
- `Asset`, `AssetAssignment`
- `IncidentReport`, `ConsentDocument` (unless compliance is mandatory at launch)
- `Goal`, `DevelopmentPlan` (roadmap phase)

### Relationship risks
- Ambiguous person-role mapping without scoped assignments.
- Notes/tasks visibility leakage if relationships are not scope-gated.
- Attendance integrity risk if RSVP and participant mapping are disconnected.

### Likely Prisma modeling issues
- Missing composite uniques (e.g., one role per person per scope).
- Missing many-to-many join tables for roster and event participation.
- No explicit enum strategy for lifecycle/status fields.
- Incomplete referential actions for archive/delete behavior.

### Required indexes (MVP baseline)
- `(organizationId)` on all tenant-scoped entities
- `(teamId, seasonId)` on roster membership
- `(eventId, personId)` unique on RSVP and attendance
- `(assigneeId, status, dueDate)` on tasks
- `(entityType, entityId, createdAt)` on audit events
- `(personId, createdAt)` on notes/observations

### Multi-tenant considerations
- Start with single-organization operational mode but model true org scoping from day one.
- Enforce tenant boundary in all reads/writes server-side.
- Avoid global lookups without org filters.

### Audit logging strategy
- Emit append-only `AuditEvent` records for create/update/delete and workflow transitions.
- Include actor, scope, entity, action, before/after summary, timestamp.
- Require audit events for roles, roster changes, notes visibility changes, attendance edits, and task lifecycle changes.

## 9. Permissions and Security Review
Current permission model is directionally correct but incomplete for build. It needs action-level policy with relationship-aware rules.

### Recommended role model
- Platform/Organization Admin
- Program Director
- Coach
- Assistant Coach
- Parent/Guardian
- Athlete

### Relationship-aware access rules
- Parent/Guardian can view only linked athlete data and only permitted data classes.
- Coach access is limited to assigned program/team scope.
- Cross-team access defaults to deny unless explicitly granted.

### Scoping model
- Every protected resource is evaluated by organization + optional program/team context.
- Role grants are scoped, not global.

### Parent/guardian visibility
- Allow schedule, RSVP status, attendance summaries, and permitted notes for linked athletes.
- Restrict staff-only notes and sensitive operational comments.

### Audit requirements
- Permission changes, role assignments, relationship edits, attendance edits, and note visibility changes must be logged.

### Sensitive data boundaries
- No medical/health records in MVP.
- Minimize PII fields; encrypt secrets and use least-privilege DB access.
- Enforce server-side authorization for every write and sensitive read.

## 10. UX / Screen Readiness Review
The current screen list is a good skeleton but not build-ready.

### First screens to build
1. Auth + role-resolved landing
2. Dashboard (coach/program staff first)
3. People List + Person Profile
4. Teams List + Team Detail/Roster
5. Notes Quick Capture + Timeline context
6. Events List/Calendar + Event Detail
7. Attendance Capture
8. Tasks List/Board
9. Admin Roles/Permissions (basic)
10. Audit Log (read-only initial)

### Screens to defer
- Rich analytics views
- Advanced communication inbox/chat UX
- Inventory/compliance/development-plan UI

### Mobile-first considerations
- Fast capture flows (notes/attendance) must be thumb-friendly.
- One-handed navigation patterns and large tap targets.
- Minimize required form fields in field-entry scenarios.

### Navigation model
- Left nav (desktop) + bottom nav (mobile) with role-filtered entries.
- Persistent “Quick Add” action for note/event/task.

### Dashboard priorities
- Today’s events
- Pending RSVPs
- Attendance completion status
- Overdue follow-up tasks

## 11. API / Workflow Readiness Review
Current docs do not provide a canonical API contract. Define either route handlers or server actions with consistent naming and validation.

Recommended operation surface:
- **People:** create/update person, list by scope, get profile, link guardian-athlete relationship
- **Teams:** create/update team, assign staff, list teams by program
- **Roster membership:** add/remove athlete in team-season, list roster, bulk import optional
- **Notes:** create observation note, list timeline by athlete/team, update visibility class
- **Events:** create/publish event, list upcoming, update event status/type
- **RSVP:** submit/modify availability, list RSVP status by event
- **Attendance:** record attendance per participant, bulk mark, update with reason codes
- **Tasks:** create from source record, assign, change status, list by assignee/scope
- **Audit log:** append on protected mutations, query by entity/time/scope with admin-only access

## 12. Implementation Sequence
### Phase 0: Repo and App Foundation
- Initialize Next.js app with TypeScript + Tailwind
- Add Prisma + Neon Postgres connection
- Select/authenticate provider integration
- Add env management and baseline CI (lint/typecheck/test)
- Establish design tokens and base layout shell

### Phase 1: Core Data Model
- Implement org/program/team/season/person entities
- Implement scoped role assignments and relationships
- Implement roster membership and participant joins
- Add audit event infrastructure and migration strategy

### Phase 2: Coach-Centered MVP Workflows
- People and roster management flows
- Observation notes capture and timeline
- Event scheduling and publishing
- RSVP and attendance workflows
- Follow-up task workflows

### Phase 3: Audit and Operational Visibility
- Admin audit log experience
- Basic dashboard metrics/cards
- Data quality checks and operational summaries

### Phase 4: Hardening and Launch Readiness
- Permission matrix enforcement tests
- Mobile UX refinements for field use
- Seed/demo data and rollout checklist for first pilot program

## 13. GitHub Issue Seed List
1. **Title:** Establish canonical terminology and MVP boundary glossary  
   **Purpose:** Standardize language across all planning and future implementation artifacts.  
   **Acceptance criteria:** Glossary committed; conflicting terms replaced/referenced; non-MVP list ratified.  
   **Dependencies:** None  
   **Suggested labels:** `planning`, `product`, `mvp`

2. **Title:** Create canonical permissions matrix with scoped action rules  
   **Purpose:** Define enforceable authorization model before coding features.  
   **Acceptance criteria:** Action/resource matrix complete for all MVP roles and scopes; relationship-aware rules documented.  
   **Dependencies:** Glossary issue  
   **Suggested labels:** `planning`, `security`, `authorization`

3. **Title:** Author `API_CONTRACT.md` for MVP server operations  
   **Purpose:** Define stable operation contract for people, teams, notes, events, RSVP, attendance, tasks, audit.  
   **Acceptance criteria:** Operation list, payload shapes, validation/error model, auth requirements documented.  
   **Dependencies:** Permissions matrix issue  
   **Suggested labels:** `planning`, `api`, `mvp`

4. **Title:** Author `PRISMA_MODEL_DRAFT.md` with MVP-first schema  
   **Purpose:** Convert domain model into implementable Prisma design.  
   **Acceptance criteria:** All MVP entities/relations/enums/indexes and uniqueness constraints documented.  
   **Dependencies:** Permissions matrix issue  
   **Suggested labels:** `planning`, `data-model`, `prisma`

5. **Title:** Author `ACCEPTANCE_CRITERIA.md` for all MVP stories  
   **Purpose:** Ensure build prompts and issues are testable and complete.  
   **Acceptance criteria:** Each MVP story has Given/When/Then AC and role/scope constraints.  
   **Dependencies:** API contract issue  
   **Suggested labels:** `planning`, `qa`, `mvp`

6. **Title:** Define Next.js + Vercel + Neon technical architecture baseline  
   **Purpose:** Lock deployment and runtime assumptions for solo-builder velocity.  
   **Acceptance criteria:** Architecture doc includes folder/routing/service patterns, env vars, migration strategy, CI gates.  
   **Dependencies:** API contract issue, Prisma draft issue  
   **Suggested labels:** `architecture`, `devops`, `planning`

7. **Title:** Design coach-first dashboard and navigation spec  
   **Purpose:** Turn screen inventory into implementable IA and mobile-first nav model.  
   **Acceptance criteria:** Primary nav map, role-based entry points, first-screen wireframe-level requirements defined.  
   **Dependencies:** Glossary issue  
   **Suggested labels:** `ux`, `planning`, `mvp`

8. **Title:** Finalize MVP implementation phase plan and dependency map  
   **Purpose:** Convert roadmap to execution order suitable for issue sprinting.  
   **Acceptance criteria:** Phase gates, issue dependencies, and definition-of-done per phase committed.  
   **Dependencies:** Issues 2–7  
   **Suggested labels:** `planning`, `roadmap`, `execution`

9. **Title:** Define audit logging policy and retention boundaries  
   **Purpose:** Ensure trust and traceability from first release.  
   **Acceptance criteria:** Audit event taxonomy, required capture points, access controls, retention policy documented.  
   **Dependencies:** Permissions matrix issue, Prisma draft issue  
   **Suggested labels:** `security`, `compliance`, `planning`

10. **Title:** Define MVP test strategy and CI quality gates  
    **Purpose:** Set minimum viable quality standards for solo implementation.  
    **Acceptance criteria:** Required checks (lint/typecheck/test), minimum smoke E2E list, PR merge gates documented.  
    **Dependencies:** Architecture baseline issue  
    **Suggested labels:** `testing`, `ci`, `planning`

## 14. Open Questions
### Must decide before build
- Auth provider choice (Clerk vs Auth.js) and migration tolerance.
- Single-org-only launch vs multi-org-ready from day one at data layer.
- Parent/guardian visibility policy for notes (what is visible vs staff-only).
- Whether inbox/communication routing is metadata-only in MVP or includes message threads.
- Required legal/compliance constraints for youth athlete data in target market.

### Can decide during build
- Dashboard metric card exact definitions and thresholds.
- CSV import timing and scope.
- Task board UX format (kanban vs list-first).

### Can defer until after MVP
- Development plans/goals module depth.
- Advanced analytics and automation strategy.
- External integrations (calendar sync, messaging platforms, etc.).

## 15. Recommended Next Copilot Prompt
“Using `planning/BUILD_READINESS_REVIEW.md` as the source of truth, create/update the missing planning artifacts (`planning/API_CONTRACT.md`, `planning/ACCEPTANCE_CRITERIA.md`, `planning/PRISMA_MODEL_DRAFT.md`) and align existing docs to the standardized terminology and MVP boundaries. Do not write application code yet. Preserve coach-centered MVP focus, include explicit role/scope authorization rules, and produce issue-ready acceptance criteria for each MVP workflow. Output must: (1) keep existing valid product thinking, (2) clearly mark MVP vs later scope, (3) include dependencies and acceptance criteria per workflow, and (4) end with a checklist confirming each file is implementation-ready.”
