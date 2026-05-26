# Arc 20V — GearOps Offline Sync Phase 2 Design

## Status

Design complete.  
This arc is architecture/documentation only and does not introduce a full offline database, conflict-resolution engine, native mobile app, or guaranteed background sync runtime.

## Arc Intent

Arc 20V defines the future full offline synchronization model for GearOps based on Arc 20K mobile/offline foundation behavior and Arc 20N/20R/20S/20T/20U release-candidate learnings.

This arc defines:

- offline data boundaries
- action classification policy
- queue and sync contract shape
- conflict detection and resolution policy
- history trust model
- permission revalidation approach
- mobile web vs native shared model
- future API contract expectations
- UX expectations and safety messaging
- phased implementation sequence
- explicit non-goals

This arc does **not** implement offline replication, background sync guarantees, or hidden finalization.

---

## 1) Foundations and Guardrails from Earlier Arcs

Arc 20V keeps Arc 20K bounded foundations in force:

- local states remain explicit: drafted locally, pending sync, sync failed, needs review, completed, online required
- local intent is not final state
- server confirmation remains required before history is official
- high-risk operational actions remain online-required unless a later product decision explicitly changes policy

Arc 20V also assumes Arc 20R pilot feedback, Arc 20S import/export realities, Arc 20T reservation/hold behavior, and Arc 20U notification handoff boundaries remain valid inputs.

---

## 2) Local Data Scope (Future Offline Snapshot Boundary)

Future offline-capable GearOps should cache only the minimum operational snapshot needed for safe field continuity in the active organization context.

### Cache-allowed candidates

- gear item summary (name/type/status flags, not full private details)
- gear item identifiers (scan/manual lookup keys)
- category/template display metadata
- readiness summary
- location summary
- custody summary
- event gear plan summary
- event gear checklist summary
- assigned/staged/deployed gear summary
- recent activity summary (bounded, non-sensitive)
- pending action queue metadata
- offline-safe drafts
- user role/permission snapshot (time-bounded)
- active organization context metadata

### Cache restrictions

- organization scope isolation is mandatory
- bounded retention and expiration are mandatory
- sensitive payloads must be minimized/redacted

### Do not cache

- private journal content
- sensitive/private notes
- unnecessary guardian/private contact details
- unnecessary athlete personal details
- medical/personal data
- unrestricted audit records
- data outside active organization scope
- data from unauthorized modules

---

## 3) Offline Action Classification (Refined)

Arc 20V refines Arc 20K classes by adding explicit queueability and hard-deny categories while preserving current safety boundaries.

| Action / workflow | Classification | Notes |
| --- | --- | --- |
| Lookup/search from cached data | `OFFLINE_SAFE` | Read-only on cached snapshot. |
| Scan lookup against cached identifiers | `OFFLINE_DRAFTABLE` | Local draft/lookup assist; confirmation comes from refresh/sync. |
| Condition note draft | `OFFLINE_SAFE` | Queueable as non-destructive note intent. |
| Maintenance note draft | `OFFLINE_SAFE` | Queueable, conflict-aware at sync. |
| Inspection checklist draft | `OFFLINE_SAFE` | Local checklist intent; server confirmation required for official completion. |
| Readiness verification draft | `OFFLINE_SAFE` | Queueable with validation on sync. |
| Event recovery note draft | `OFFLINE_DRAFTABLE` | Draftable and reviewable before submit. |
| Consumable adjustment draft | `OFFLINE_DRAFTABLE` | Queueable with quantity revalidation. |
| Check-in | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Review-required before confirmation if state changed. |
| Check-out | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Never treated as final until confirmed. |
| Custody transfer | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Conflict-prone and always review-sensitive. |
| Assignment change | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Revalidate permission, readiness, and active assignment state. |
| Staging | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Event state may drift; conflict checks required. |
| Deployment | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | High operational impact; conflict checks required. |
| Return/recovery state change | `OFFLINE_LIMITED` + `OFFLINE_QUEUEABLE` | Reconcile with current custody/event state. |
| Reservation/hold creation | `ONLINE_REQUIRED` | Availability-conflict risk remains too high for offline finalization. |
| Reservation/hold fulfillment | `ONLINE_REQUIRED` | Current policy keeps reservation transitions live-only. |
| Guardian approval-required action | `NEVER_OFFLINE` | Approval must be live and policy-validated. |
| Admin configuration change | `NEVER_OFFLINE` | Always live, permission-sensitive, org-impacting. |
| Destructive delete/archive | `NEVER_OFFLINE` | Must stay online with explicit confirmation and audit context. |
| Final audit closure | `NEVER_OFFLINE` | Must be server-confirmed in-session. |
| Import/export | `ONLINE_REQUIRED` | Large-scope and integrity-sensitive operations stay live-only. |
| QR/label generation | `ONLINE_REQUIRED` | Requires current identifier integrity context. |
| Notification handoff events | `ONLINE_REQUIRED` | Trigger only from server-confirmed outcomes. |

Classification definitions:

- `OFFLINE_SAFE`: low-risk and queue-safe with server confirmation
- `OFFLINE_DRAFTABLE`: local capture allowed; operator review expected before sync attempt
- `OFFLINE_QUEUEABLE`: can enter sync queue (used with safe/limited classes)
- `OFFLINE_LIMITED`: conflict-prone actions allowed only with review and strict confirmation rules
- `ONLINE_REQUIRED`: blocked while offline
- `NEVER_OFFLINE`: blocked offline by design and policy

---

## 4) Sync Queue Design (Future Model)

### Core domain concepts

- `GearOfflineAction`
- `GearOfflineActionQueue`
- `GearSyncBatch`
- `GearSyncAttempt`
- `GearSyncResult`
- `GearSyncConflict`
- `GearSyncRetryPolicy`
- `GearSyncDependency`
- `GearSyncOperationType`
- `GearSyncActionStatus`
- `GearSyncServerConfirmation`
- `GearSyncReviewRequired`

### `GearOfflineAction` minimum fields

- action id
- organization id
- user reference
- device/session id (when available)
- target item/reference
- action type / operation type
- payload summary (sanitized)
- local event timestamp
- server confirmation timestamp (nullable until confirmed)
- current action status
- retry count
- dependency chain metadata
- conflict-candidate flag
- review-required flag
- safe display message
- error details (sanitized)
- confirmed audit/history link (nullable until confirmed)

### Queue behavior rules

1. Queue is organization-scoped and permission-scope aware.
2. Queue preserves action ordering but supports dependency grouping and parallel-safe batches where explicitly allowed.
3. High-risk actions require explicit review gate before submission.
4. Sync submission is batch-oriented, but results are tracked per action.
5. Failed actions remain visible until retry/discard/acknowledge.
6. Confirmed actions receive server confirmation metadata and history links.
7. Queue must preserve local intent timestamps even when submission is delayed.

---

## 5) Conflict Detection Design

Conflicts are detected during sync validation and batch apply using current server state plus queued action context.

### Conflict triggers (minimum)

- item checked out by another user while action was offline
- item custody/transfer changed before queued transfer applies
- item moved to out-of-service/limited state before checkout/deployment action applies
- item deployed to different event
- reservation/hold state changed or conflicted before apply
- consumable quantity drift invalidates queued adjustment
- category/template rule drift invalidates queued payload
- guardian approval policy becomes required/denied
- item archived/deactivated before apply
- user permission changed/revoked
- organization membership/access changed

### Detection requirements

- compare queue action preconditions against current server state/version
- evaluate dependency chain validity before apply
- evaluate permission snapshot freshness and current authorization
- mark conflict candidates before mutation attempts where possible
- return structured conflict reasons suitable for operator/admin review UI

---

## 6) Conflict Resolution Strategy

Resolution must prioritize safety, trust, and explicit operator visibility.

### Allowed resolution outcomes

- auto-apply if safe and preconditions still match
- server reject with explicit reason
- user review required
- admin review required
- convert to note/history-only intent record
- create follow-up task candidate
- discard local action
- retry after refresh
- merge non-conflicting note/comment content
- block high-risk state change

### Safety-critical resolution rules

- custody, assignment, checkout/check-in, deployment, reservation, and readiness-impacting actions must never be silently resolved when conflict risk exists
- high-risk conflicts default to reject + review
- “best effort” auto-merge is limited to non-destructive note/comment-like payloads
- unresolved conflict items remain visible until explicit user/admin outcome

---

## 7) Activity and History Trust Model

Server-confirmed history remains authoritative.

Rules:

1. Local actions appear as local intent/pending only.
2. Only server-confirmed actions enter official history/audit timelines.
3. Rejected actions are not displayed as completed history.
4. Conflict-resolved actions show explicit resolution context.
5. Local event timestamp is preserved separately from server confirmation timestamp.
6. Audit trails distinguish local intent from confirmed state transition.
7. Notification handoff candidates are produced only from confirmed outcomes.

---

## 8) Permission and Authorization Revalidation Model

Future offline sync must assume permission drift is possible.

Required model:

- cached permission snapshot with explicit expiration
- sensitive actions remain online-required when snapshot is stale/expired
- sync-time revalidation against current server permissions
- rejected sync for permission changes/revocations
- guardian approval requirements revalidated at sync-time
- admin configuration remains online-only
- organization access/membership revalidated per sync batch

If revalidation fails, action status moves to review-required/rejected with clear remediation messaging.

---

## 9) Mobile Web PWA vs Native Mobile Path

Arc 20V defines a shared sync domain model usable by both mobile web and future native runtime.

### Shared between PWA and native

- action classification vocabulary
- queue metadata model
- sync batch/attempt/result contracts
- conflict object shape
- history trust rules
- API expectations

### Runtime differences (deferred implementation)

- PWA local storage/indexed-db constraints and browser lifecycle limits
- native storage and background execution capabilities (subject to platform policy)
- device/session identity lifecycle details
- app-store packaging and operational release controls

Arc 20V defers app-store/native delivery decisions to Arc 20W readiness planning.

---

## 10) Future API / Backend Contract Expectations (Design-Level)

Potential future API contract surfaces:

- fetch offline snapshot
- submit sync batch
- validate sync batch
- return sync result
- return conflict details
- resolve conflict
- refresh item state
- refresh event gear plan state
- refresh permission snapshot
- acknowledge failed action
- discard pending action

Design rules:

- responses must be action-level and batch-level
- conflict payloads must be structured and human-readable
- permission failures must be explicit
- no endpoint in this arc is implemented as production sync runtime
- optional placeholders (if ever added) must be clearly non-functional and documented

---

## 11) Required UX Patterns for Future Sync

Future sync UX must include:

- offline mode banner
- local draft indicator
- pending sync indicator
- sync failed indicator
- conflict indicator
- review-required panel
- retry/discard controls
- refresh-before-action warning
- online-required action block
- confirmed-history marker
- stale data warning
- permission-expired warning

UX language rules:

- never present pending as completed
- distinguish “saved locally” vs “confirmed on server”
- provide safe next action guidance (retry, refresh, review, discard)

---

## 12) Data Safety and Privacy Boundaries

Must not be stored/synced casually:

- private journal content
- sensitive notes
- unnecessary personal data
- guardian private contact info unless explicitly required and authorized
- medical/personal information
- broad unrestricted audit logs
- cross-organization data
- unauthorized module data

Privacy requirements:

- minimize cached payloads
- encrypt/protect local storage where platform supports it
- enforce organization scope boundaries on every read/write/sync path
- preserve principle of least data and least privilege

---

## 13) Future Implementation Sequencing

Proposed staged path:

1. **Phase 2A — Offline snapshot read model**
   - bounded snapshot API and local read cache
2. **Phase 2B — Offline-safe drafts**
   - note/checklist/draft capture flows with clear local intent state
3. **Phase 2C — Queued low-risk actions**
   - queueable safe actions with retry and per-action result handling
4. **Phase 2D — Sync validation endpoint**
   - server-side preflight validation with structured reject/conflict results
5. **Phase 2E — Conflict detection and review UX**
   - conflict panel, review flows, retry/discard tooling
6. **Phase 2F — Limited custody/action sync**
   - carefully gated limited high-impact queue flows with strict review
7. **Phase 2G — Native mobile readiness review**
   - evaluate shared model portability, background constraints, and product go/no-go

---

## 14) Known Non-Goals (Explicit)

Arc 20V does **not** deliver:

- full offline sync implementation
- full offline database replication
- CRDT/conflict-resolution runtime engine
- native mobile app
- guaranteed background sync system
- offline admin configuration
- offline guardian approval
- offline destructive actions
- offline final audit closure
- hidden/offline finalization
- sync finalization without server confirmation

---

## 15) Validation Checklist (Design Arc)

- Design-only documentation arc confirmed.
- Action classification aligns with Arc 20K bounded behavior and status language.
- High-risk actions remain online-required or review-gated; no silent high-risk resolution.
- Official history remains server-confirmed and trustworthy.
- Permission and privacy boundaries are explicit.
- Phased implementation sequence is defined.
- No claim that unsupported offline capability is already implemented.

---

## 16) Arc 20W Recommended Next Steps

1. Convert Arc 20V queue/conflict/API model into native-readiness decision inputs.
2. Define PWA vs native device/session identity requirements and storage constraints.
3. Confirm product policy for any future expansion of currently online-required actions.
4. Define operational rollout guardrails, pilot criteria, and fallback strategy for phased sync delivery.
5. Keep server-confirmed history trust model and privacy constraints as hard gates for any implementation.

---

## Alignment References

- `docs/product/design-system/gearops-mobile-offline-foundation.md`
- `planning/PHASE_20N_GEAROPS_RELEASE_CANDIDATE_STABILIZATION.md`
- `planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md`
- `planning/PHASE_20R_GEAROPS_PILOT_TEST_PLAN_AND_FEEDBACK_INSTRUMENTATION.md`
- `planning/PHASE_20S_GEAROPS_IMPORT_EXPORT_AND_QR_LABEL_OPERATIONS.md`
- `planning/PHASE_20U_GEAROPS_NOTIFICATION_HANDOFF_DESIGN.md`
- `lib/gear-offline.ts`
