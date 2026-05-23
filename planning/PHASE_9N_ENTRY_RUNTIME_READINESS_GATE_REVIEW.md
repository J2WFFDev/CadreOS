# Phase 9N — Entry Runtime Readiness Gate Review (Pre-Arc 10)

## Purpose

Perform a final readiness gate review of Phase 9A–9M Entry/Auth foundation work before starting Arc 10 runtime Entry implementation.

This phase is review/decision only:

- No broad Entry runtime behavior is implemented.
- No `ObservationNote` / `FollowUpTask` migration is implemented.
- No Feed/Inbox/Journal runtime behavior is implemented.
- No messaging/notifications/workflow automation runtime behavior is implemented.
- No guardian-facing feed/parent portal behavior is implemented.
- No broad schema redesign is implemented.
- Organization scoping remains preserved.
- No new major dependencies are introduced.

## Phase 9A–9M Foundation Review (What Is Completed)

### 1) Authorization architecture baseline

Completed and implemented:

- Central actor-role context + authorization helper foundation in `lib/authorization/index.ts`.
- Explicit staff gating across operational notes/tasks/events/people/team/dashboard routes.
- Scope-aware staff narrowing (`ORGANIZATION` / `PROGRAM` / `TEAM`) with deny-on-ambiguity defaults.
- Program-context-aware team access checks now wired on team/event detail paths.
- Explicit deny outcomes and structured authorization decision logging are present.

Current operational posture:

- `ObservationNote` read behavior is staff-only and visibility-gated (`STAFF_ONLY` only supported).
- `FollowUpTask` detail no longer uses non-staff assignee/creator fallback; task detail is staff-facing.
- Guardian relationship behavior remains staff-diagnostic-only, not guardian-facing runtime.

### 2) Visibility handling baseline

Completed and implemented:

- Operational visibility classification in `lib/operational-visibility.ts`:
  - `TEAM_STAFF`
  - `ORGANIZATION_SCOPED`
  - `UNRESOLVED` (deny/filter default)
- Shared visibility guardrails for note/task list/detail/history/dashboard slices.
- Linked-record inheritance conflict handling for note↔task and event↔task context.
- Unresolved or conflicting linked visibility is denied/filtered by default.

Current operational posture:

- Runtime still supports only current operational visibility assumptions (`ObservationNote` effectively `STAFF_ONLY`).
- `FollowUpTask` visibility remains derived from linked operational context (no first-class task visibility column).

### 3) Validation matrix and remediation baseline

Completed and implemented:

- Phase 9K produced actor-by-surface authorization/visibility matrix and identified concrete gaps.
- Phase 9L remediated high-priority runtime gaps:
  - `/people` staff-gated and scope-aware.
  - `/people/[personId]` scope-aware with narrowed related workflow summaries.
  - Task detail staff-only behavior aligned.
  - Team/program context wiring corrected for scope checks.
  - Dashboard/review scope narrowing increased for non-org-scope staff.

### 4) Runtime hardening baseline

Completed and implemented:

- Deny-by-default for unresolved scope/visibility.
- Safer query narrowing for non-org-scope staff on operational surfaces.
- Route-level linked-context conflict rejection on note/task create/update.
- Existing operational flows (`ObservationNote`, `FollowUpTask`, event/attendance workflows) preserved without Entry cutover.

### 5) Migration safety recommendations baseline

Completed in design/review phases:

- Migration dependency mapping and blocker cataloging are documented (Phase 9C).
- Entry migration remains explicitly deferred pending prerequisite gates.
- Minimal-first runtime strategy defined (Phase 9M): non-destructive, flagged, sidecar-style introduction as safest candidate.

## Readiness Evaluation for Arc 10 Runtime Entry Work

### Completed prerequisite work (gate positives)

- Authorization helper architecture exists and is integrated across active operational surfaces.
- Scope-aware narrowing and deny-on-ambiguity defaults are in place for staff-facing operational routes.
- Visibility-classification and linked-relationship hardening are implemented for current models.
- Highest-priority 9K gaps were remediated in 9L.
- Phase 9M defines a low-blast-radius first runtime Entry slice that avoids broad migration/cutover.

### Unresolved risks (gate negatives)

1. Attendance still lacks a dedicated first-class visibility policy model.
2. Guardian-facing runtime boundaries are still deferred rather than implemented as positive guardian read policy enforcement.
3. Full Entry-era mixed-visibility enforcement (`PRIVATE`, `SHARED`, `GUARDIAN_LINKED`) is not implemented at runtime yet.
4. Migration/backfill execution strategy is still intentionally deferred; no staging migration dry-run for Entry migration has been performed.

### Unresolved authorization concerns

- No centralized Entry-era per-record visibility evaluator is active for all planned Entry categories.
- Non-staff runtime read patterns for future assignee/author/guardian scenarios remain intentionally undefined.
- Entry-era query builders for mixed visibility categories are not implemented yet.

### Unresolved visibility concerns

- `ObservationNote` remains `STAFF_ONLY` operationally; broader visibility categories are not activated.
- `FollowUpTask` visibility remains derived rather than persisted and policy-driven.
- Guardian-linked and athlete-facing visibility categories remain deferred by design.

### Migration readiness

- **Not migration-ready for broad Entry cutover.**
- Readiness is sufficient only for non-destructive, non-authoritative runtime introduction slices.
- Broad migration remains blocked pending explicit backfill semantics, compatibility strategy finalization, and migration dry-run confidence.

### Operational continuity readiness

- **Ready for low-risk additive work only.**
- Current operations are stable under hardened staff/scope guardrails.
- Readiness supports adding guarded Entry scaffolding that does not change authoritative operational reads/writes.

## Ready Now

Low-risk Entry runtime work that is safe to begin in Arc 10:

1. **Flagged, non-authoritative Entry sidecar introduction for new notes only** (no route cutover).
2. **Strict org-scoped sidecar linkage + uniqueness constraints** (`sourceModelType`, `sourceModelId`) for traceability.
3. **Write-path integration only after existing note auth/scope checks pass**, with fail-safe behavior that never blocks legacy note writes.
4. **`STAFF_ONLY`-only visibility mapping in sidecar** with deny/skip for unsupported states.
5. **Operational parity checks** proving dashboard/notes/tasks/history outputs remain unchanged when sidecar is enabled.

Safe implementation slices:

- Slice A: schema + feature flag plumbing (no read dependence).
- Slice B: note-create sidecar write behind flag (fail-safe, non-blocking).
- Slice C: instrumentation + parity validation (no surface behavior change).

Safe non-destructive runtime introductions:

- Additive metadata sidecar writes.
- Auditability/observability around sidecar write attempts and failures.
- Rollback-ready flag disable path with zero operational data loss.

## Still Blocked

Unsafe runtime Entry concepts to avoid now:

1. Broad Entry replacement of note/task read or write paths.
2. Dual-write authoritative content migration for notes/tasks.
3. Any Entry-backed dashboard/history/feed query cutover.

Unresolved guardian visibility concerns:

- No guardian-facing read path + consent/disclosure model.
- No positive guardian-linked per-record enforcement for runtime parent exposure.

Feed/Inbox blockers:

- No safe Entry visibility engine for mixed-category feed/inbox rendering.
- Inbox routing remains non-authoritative for runtime triage behavior.

Messaging/notification blockers:

- Messaging, notification, and workflow automation policy/enforcement boundaries are not implemented.

Unresolved migration risks:

- Backfill semantics and reconciliation strategy are not runtime-validated.
- No full staging dry-run for broad Entry migration/cutover.
- Operational history compatibility would still require a deliberate compatibility phase before replacement.

## Recommendation

### Arc 10 go/no-go

**Proceed to Arc 10 with a constrained scope.**

### Proceeding conditions

Arc 10 should proceed only for low-risk, non-destructive Entry runtime introduction slices (no broad migration/cutover).

### Additional prerequisite work still needed (before broader Entry runtime)

1. Define and implement explicit attendance visibility policy.
2. Define positive guardian-linked read policy + consent/disclosure boundaries before guardian-facing runtime.
3. Implement Entry-era mixed-visibility authorization/query enforcement for future categories.
4. Complete migration execution prerequisites (backfill semantics + dry-run strategy) before any broad model migration.

## First Arc 10 Candidate

**Recommended first Arc 10 implementation slice:**  
Implement a **feature-flagged `ObservationNote` Entry sidecar write path** for newly created notes only, storing minimal non-authoritative metadata (`organizationId`, source reference, `entryKind=NOTE`, `authorPersonId`, `STAFF_ONLY` visibility mapping, timestamps) while keeping all existing note/task/dashboard/history reads and authoritative writes unchanged.

Why this first:

- Lowest operational blast radius.
- Preserves current hardened authorization/visibility behavior.
- Validates Entry runtime linkage shape without enabling Feed/Inbox/guardian runtime.
- Supports immediate rollback by disabling the flag.

## Validation

- This readiness review reflects currently implemented runtime/auth behavior from:
  - `lib/authorization/index.ts`
  - `lib/operational-visibility.ts`
  - `app/(dashboard)/notes/**`
  - `app/(dashboard)/tasks/**`
  - `app/(dashboard)/people/**`
  - `app/(dashboard)/teams/[teamId]/page.tsx`
  - `app/(dashboard)/dashboard/page.tsx`
  - Phase 9A–9M planning artifacts
- Confirmed in this phase:
  - No broad Entry runtime behavior was added.
  - No `ObservationNote` / `FollowUpTask` migration was added.
  - No Feed/Inbox/Journal runtime behavior was added.
  - No messaging/notification runtime behavior was added.
- Runtime code was not touched in this phase, so no additional typecheck/build pass was required for this documentation update.

## PR Summary

Phase 9N confirms CadreOS is ready to begin Arc 10 only with constrained, non-destructive Entry runtime slices. Authorization and visibility hardening from 9E–9L is in place for current staff-facing operational workflows, and 9M’s minimal-sidecar strategy remains the safest first move. Major blockers remain for broad Entry rollout (attendance policy, guardian-linked runtime boundaries, mixed-category visibility enforcement, and migration dry-run readiness). Recommended next step: start Arc 10 with a flagged `ObservationNote` Entry sidecar write path and keep all existing operational reads/writes authoritative and unchanged.
