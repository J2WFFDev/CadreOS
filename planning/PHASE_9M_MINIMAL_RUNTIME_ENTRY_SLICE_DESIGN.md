# Phase 9M — Minimal Safe Runtime Entry Slice Design

## Purpose

Define the smallest safe runtime `Entry` implementation slice after Phase 9A–9L hardening, without broad migration of `ObservationNote` or `FollowUpTask`.

This phase is architecture/runtime-design only:

- No full `Entry` migration.
- No replacement of `ObservationNote` or `FollowUpTask`.
- No Feed/Inbox/Journal runtime behavior.
- No messaging/chat, notifications/reminders, workflow automation, or AI/recommendation behavior.
- No guardian-facing feed/portal behavior.
- No broad schema redesign.
- No new major dependencies.

## Phase 9A–9L Runtime/Auth Review (Implemented Baseline)

Based on current runtime helpers and dashboard routes:

- `lib/authorization/index.ts`
- `lib/operational-visibility.ts`
- `app/(dashboard)/notes/**`
- `app/(dashboard)/tasks/**`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/people/**`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `planning/PHASE_9A_*` through `planning/PHASE_9L_*`

Current confirmed baseline:

1. Organization scoping is the base boundary and is consistently applied.
2. Staff-only gating is explicit for operational notes/tasks/people/dashboard surfaces.
3. Scope-aware narrowing exists for non-org-scope staff and ambiguous scope is deny-by-default.
4. `ObservationNote` operational visibility remains effectively `STAFF_ONLY` only.
5. `FollowUpTask` visibility remains derived from linked note/event context; unresolved linkage denies.
6. Guardian relationship behavior remains staff diagnostics only; no guardian-facing read runtime is active.
7. Task detail non-staff ownership fallback has been removed; task detail remains staff-facing.

## Smallest Safe Runtime Entry Slice

### Recommended minimal slice

**ObservationNote wrapper sidecar (`EntryRuntimeRef`) with zero route cutover.**

The first runtime `Entry` slice should be a narrow sidecar/wrapper for newly-created notes only:

- Keep `ObservationNote` as the operational source of truth.
- Add a lightweight sidecar record that references note identity and core runtime metadata.
- Do not query this sidecar for dashboard, list, detail, history, or guardian workflows yet.
- Use it only for controlled runtime traceability and compatibility proofing.

### Initial support (and only this support)

1. **Minimal metadata**
   - `organizationId`
   - `sourceModelType` (`ObservationNote`)
   - `sourceModelId`
   - `entryKind` (`NOTE`)
   - `createdAt`, `updatedAt`
2. **Visibility handling**
   - Persist only current supported operational visibility (`STAFF_ONLY`) from source note.
   - Deny/skip unresolved/unsupported visibility values.
3. **Ownership relationships**
   - Persist `authorPersonId` from note source.
   - No assignee/owner workflow behavior.
4. **Organizational scoping**
   - Hard require same-org source linkage.
   - No cross-org lookup path.
5. **Lightweight linking**
   - Optional normalized pointers to existing note context (`teamId`, `eventId`, `athletePersonId`) for future-safe indexing only.
   - No cross-surface read expansion from these links in this phase.

## What Entry Must NOT Support Initially

- Feed runtime behavior.
- Inbox triage behavior.
- Messaging/chat behavior.
- Notifications/reminders behavior.
- Guardian-facing runtime visibility or parent portal reads.
- Workflow automation behavior.
- AI/recommendation behavior.
- Broad dashboard/history/query migration to Entry-backed reads.

## Runtime Introduction Approach Evaluation

### 1) Wrapper/adaptor layer
- **Safety:** High
- **Risk:** Low data-loss risk; low rollback friction.
- **Cost:** Moderate adapter discipline.

### 2) Dual-write
- **Safety:** Medium
- **Risk:** Split-brain drift and reconciliation burden.
- **Cost:** Higher operational complexity.

### 3) Parallel model
- **Safety:** Medium-low for note/task continuity
- **Risk:** Mixed query semantics and reporting confusion.
- **Cost:** High temporary complexity.

### 4) Minimal sidecar model
- **Safety:** **Highest** for first runtime slice
- **Risk:** Lowest blast radius when constrained to non-authoritative metadata.
- **Cost:** Low implementation and rollback cost.

## Safest First Runtime Candidate

**ObservationNote wrapper + minimal sidecar model** is the safest first candidate.

Why this is safest now:

1. Preserves current operational continuity and existing hardened auth/visibility flows.
2. Avoids replacing note/task read and write paths.
3. Allows fast rollback by disabling sidecar writes without losing operational data.
4. Proves runtime Entry linkage shape without introducing Feed/Inbox/guardian exposure risk.

## Migration Safety Requirements

1. **Rollback expectations**
   - Feature-flagged sidecar write path.
   - Safe disable path with no impact to `ObservationNote` reads/writes.
   - No destructive data transform in first slice.
2. **Authorization enforcement**
   - Reuse existing staff-role and scope checks before any sidecar write.
   - No new bypass path around `resolveActorRoleContext`-based decisions.
3. **Visibility defaults**
   - Default to `STAFF_ONLY` only.
   - Deny/skip unsupported visibility states.
4. **Query compatibility**
   - Existing dashboard/notes/tasks/operational-history queries remain legacy-model based.
   - No query cutover in first slice.
5. **Operational continuity**
   - No change to current create/edit/detail/list workflows for notes/tasks.
   - No guardian-facing behavior change.

## Do Not Proceed Until

- [ ] Sidecar write path is behind an explicit runtime flag.
- [ ] Sidecar model keeps `organizationId` + source FK uniqueness constraints (`sourceModelType`, `sourceModelId`).
- [ ] Sidecar writes execute only after existing note authorization/scope checks pass.
- [ ] Sidecar writes are non-blocking/fail-safe (legacy note write remains authoritative).
- [ ] Visibility mapping is locked to `STAFF_ONLY` with deny-on-unsupported behavior.
- [ ] No existing read surface (dashboard/notes/tasks/history/people/teams/events) depends on sidecar data.
- [ ] Rollback runbook is documented and tested (disable flag + verify continuity).
- [ ] Query parity spot-check confirms no behavioral changes to existing operational pages.
- [ ] Validation confirms no Feed/Inbox/Journal/messaging/notifications/guardian runtime behavior was introduced.

## Recommendation

### Safest next runtime implementation step

Implement a **flagged ObservationNote sidecar wrapper** (minimal non-authoritative Entry runtime reference) and keep all existing read paths unchanged.

### What remains too risky now

- Dual-write cutover for note/task authoritative content.
- Any task runtime replacement or unified Entry detail/list query migration.
- Any guardian-facing Entry runtime exposure.
- Any attendance/summary mixed-visibility runtime expansion.

### What should stay deferred until Arc 10+

- Feed/Inbox/Journal runtime.
- Messaging/notifications/workflow automation.
- Guardian-facing portal/read experiences.
- AI/recommendation behavior.
- Broad Entry migration for notes/tasks/events.

## Validation

- Design reflects current implemented runtime/auth behavior from Phase 9E–9L helper and page integrations.
- No broad Entry runtime migration is introduced in this phase.
- No Feed/Inbox/Journal runtime behavior is added in this phase.
- No messaging/notification runtime behavior is added in this phase.
- Runtime code is not changed in this phase, so no additional typecheck/build run is required for this document update.

## PR Summary

This Phase 9M deliverable recommends the smallest safe Entry runtime step as a **flagged ObservationNote wrapper sidecar** that stores minimal metadata, visibility (`STAFF_ONLY` only), ownership (`authorPersonId`), org scope, and lightweight source linking, while keeping `ObservationNote`/`FollowUpTask` authoritative and all operational reads unchanged. It explicitly defers Feed/Inbox/Journal, messaging/notifications, guardian-facing runtime, workflow automation, and AI behavior. Key remaining risks are dual-write drift, mixed-visibility query migration, and guardian/attendance policy expansion, all deferred until later phases (Arc 10+).
