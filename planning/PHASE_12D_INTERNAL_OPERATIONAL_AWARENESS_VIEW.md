# Phase 12D — Internal Operational Awareness View

## Goal

Create a lightweight, read-only internal operational awareness view that groups
notification/event classification metadata (from Phases 12B–12C) into a
consolidated staff-facing awareness section — without implementing Inbox, Feed,
messaging, or delivery behavior.

## Scope guardrails (enforced)

- No messaging/chat runtime behavior.
- No notification delivery behavior.
- No Feed/Inbox runtime behavior.
- No guardian-facing runtime communications.
- No workflow automation/escalation systems.
- Internal-only, read-only, awareness-focused.
- Preserve organization scoping and authorization behavior.
- No new major dependencies.

## Phase 12C baseline reviewed

Phase 12C introduced internal notification-candidate evaluation metadata
(overdue follow-up, unresolved concern, attendance review, readiness concern,
assignment/update awareness) across existing operational workflows. All
classification metadata is explicitly marked as internal-only and delivery-deferred.

## Runtime work delivered in 12D

### 1) `lib/operational-awareness.ts` — awareness grouping helper

New pure-function module (no DB queries) that:

- Accepts existing `OperationalHistoryItem[]` from `getOperationalHistory`.
- Groups items by `InternalNotificationCandidateType` from Phase 12C evaluation.
- Returns an `OperationalAwarenessView` with explicit metadata markers:
  - `internalOnly: true`
  - `deliveryDeferred: true`
  - `messagingDeferred: true`
  - `guardianCommunicationDeferred: true`
  - `isInbox: false`
  - `isFeed: false`
  - `hasDeliveryBehavior: false`

Awareness categories (mirroring Phase 12C candidate taxonomy):

- Overdue follow-up awareness
- Unresolved operational concern awareness
- Attendance review awareness
- Readiness concern awareness
- Assignment/update awareness

Organization scoping and authorization filtering remain the responsibility of the
`getOperationalHistory` caller upstream — the awareness helper is a read-only
transformation only.

### 2) `components/dashboard/operational-awareness-panel.tsx` — read-only awareness component

New React Server Component that:

- Renders `OperationalAwarenessView` as grouped awareness categories.
- Displays per-category item count, description, and read-only item list.
- Each item links to its source operational record (task, note, attendance, event).
- Footer explicitly states deferred behavior (Inbox, Feed, delivery, messaging, escalation).

### 3) Dashboard page integration

`app/(dashboard)/dashboard/page.tsx` updated to:

- Import `buildOperationalAwarenessView` and `OperationalAwarenessPanel`.
- After fetching `recentOperationalHistory` and `unresolvedOperationalHistory`,
  compute `operationalAwarenessView` by combining both (deduplicated by item ID).
- Render `OperationalAwarenessPanel` as a full-width section below the operational
  history panels.

No new DB queries are introduced; the awareness view is derived entirely from
already-fetched operational history data.

## What this view is NOT

- **Not an Inbox** — no triage semantics, no capture queue, no action ownership transfer.
- **Not a Feed** — no timeline stream, no subscription, no delivery stream.
- **Not a delivery mechanism** — no dispatch runtime, no push/SMS/email channels.
- **Not a reminder system** — no scheduled delivery, no re-notification.
- **Not a messaging surface** — no chat/thread semantics.
- **Not guardian-facing** — visibility is staff-scoped only.
- **Not an escalation trigger** — no automated follow-up or policy enforcement.

## Deferred behavior (unchanged from Phases 12A–12C)

- Inbox runtime behavior.
- Feed runtime behavior.
- Notification delivery channels (in-app dispatch, push, SMS, email).
- Message sending/chat runtime.
- Guardian-facing runtime communications.
- Workflow automation/escalation.

## Authorization and scoping preserved

- Organization scope is applied upstream in `getOperationalHistory` (via `getOrganizationScope`
  and `resolveStaffScopeResolution` in the dashboard page).
- Staff-only authorization check (`evaluateStaffOnlyContentAccess`) gates the entire
  dashboard and the awareness section within it.
- No cross-scope or guardian-facing data can enter the awareness view.

## Documentation within source files

- `lib/operational-awareness.ts` — file-level comment block describes purpose, what it
  is not, and deferred behavior.
- `components/dashboard/operational-awareness-panel.tsx` — file-level comment confirms
  read-only and informational-only intent.

## Validation guidance

1. `npm run typecheck` and `npm run build` pass without new errors.
2. Dashboard page loads without errors; awareness panel renders correctly.
3. Awareness panel shows no items when no candidates are present.
4. Awareness panel shows grouped candidate items when candidates exist.
5. All operational workflows (notes/tasks/events/attendance/history) still function.
6. Organization-scoped and staff-role authorization boundaries remain intact.
7. Awareness section is visible to staff-authenticated users only.
8. No runtime delivery queue, reminder dispatch, Feed, Inbox, messaging/chat,
   guardian communication, or escalation behavior exists.

## Source references

- `lib/operational-awareness.ts` (new)
- `components/dashboard/operational-awareness-panel.tsx` (new)
- `app/(dashboard)/dashboard/page.tsx` (updated)
- `lib/communication-classification.ts` (Phase 12B/12C — no changes)
- `lib/operational-history.ts` (Phase 12B/12C — no changes)
- `planning/PHASE_12C_INTERNAL_NOTIFICATION_CANDIDATE_EVALUATION_FOUNDATION.md`
- `planning/PHASE_12B_INTERNAL_COMMUNICATION_NOTIFICATION_CLASSIFICATION_FOUNDATION.md`

## Phase 12D output summary

Phase 12D creates a lightweight internal operational awareness view on top of the
Phase 12B/12C classification and candidate-evaluation foundation. The awareness view
groups existing candidate-classified operational history items by category and renders
them as a read-only, informational, staff-only section on the dashboard — with explicit
metadata marking it as non-Inbox, non-Feed, and non-delivery. No new DB queries are
introduced. Organization scoping and authorization checks remain intact and unchanged.
All runtime communication behavior remains deferred.

## PR Summary

Phase 12D adds a lightweight internal operational awareness view (`lib/operational-awareness.ts`
+ `OperationalAwarenessPanel`) that groups existing Phase 12B/12C classification metadata into
an informational, read-only, staff-only dashboard section. The view is explicitly marked as
non-Inbox, non-Feed, and non-delivery: no dispatch runtime, no messaging/chat, no guardian
communication, no reminders, and no escalation automation are introduced. Existing operational
workflows, organization scoping, and authorization boundaries remain intact.
