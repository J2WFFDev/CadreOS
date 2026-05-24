# Phase 12C — Internal Notification-Candidate Evaluation Foundation

## Goal

Introduce lightweight internal notification-candidate evaluation metadata across existing operational workflows without implementing runtime delivery, messaging/chat, Feed, Inbox, guardian runtime communications, or automation/escalation behavior.

## Scope guardrails (enforced)

- No messaging/chat runtime behavior.
- No notification delivery behavior.
- No Feed/Inbox runtime behavior.
- No guardian-facing runtime communications.
- No workflow automation/escalation systems.
- Keep implementation internal-only, metadata-only, and evaluation-focused.
- Preserve organization scoping and authorization behavior.
- No new major dependencies.

## Phase 12B baseline reviewed

Phase 12B introduced internal communication classification metadata and deferred all runtime delivery/messaging/feed/inbox/guardian communication behavior.

## Runtime workflow coverage reviewed in 12C

- `FollowUpTask` status/due workflows (including unresolved and stale unresolved handling)
- Operational readiness concern workflows
- Attendance concern workflows
- Stale unresolved operational item context
- Assignment/update events

## Lightweight runtime foundation delivered

### 1) Internal notification-candidate taxonomy and helpers

`lib/communication-classification.ts` now includes internal candidate types and evaluation helpers:

- overdue follow-up candidate
- unresolved operational concern candidate
- attendance review candidate
- readiness concern candidate
- assignment/update awareness candidate

Evaluation metadata is explicitly marked as:

- internal-only
- delivery deferred
- messaging deferred
- guardian communication deferred

### 2) Metadata-only evaluation integration (non-delivery)

- Entry wrapper summaries now include notification-candidate evaluation metadata.
- Operational history items now include notification-candidate evaluation metadata for:
  - unresolved/overdue/stale follow-up context
  - attendance concern context
  - readiness concern context
  - assignment/update awareness context
- Staff-facing metadata surfaces (Entry relationship + note/task/detail history badges) now expose candidate labels as internal metadata only.

### 3) Operational authority and boundaries preserved

- `ObservationNote`, `FollowUpTask`, attendance, event, roster, and role assignment models remain authoritative.
- Candidate evaluation does not enqueue reminders, dispatch notifications, send messages, or trigger escalation.
- Existing organization-scoped query filters and authorization checks remain unchanged.

## Explicitly deferred behavior (unchanged)

- Real reminders or notification sending
- Delivery queues / dispatch runtime
- Push/email/SMS delivery channels
- Inbox runtime behavior
- Feed runtime behavior
- Guardian runtime messaging/notification behavior
- Automated escalation/automation workflows

## Validation guidance

Validate 12C by confirming:

1. `npm run typecheck` and `npm run build` pass.
2. Existing operational workflows still function (notes/tasks/events/attendance/history read paths).
3. Organization-scoped and authorization-filtered operational history visibility remains intact.
4. Notification-candidate labels appear only as internal metadata context.
5. No runtime delivery queue, reminder dispatch, Feed, Inbox, messaging/chat, guardian communication, or escalation behavior exists.

## Source references

- `lib/communication-classification.ts`
- `lib/entry-runtime.ts`
- `lib/operational-history.ts`
- `components/dashboard/operational-history-panel.tsx`
- `app/(dashboard)/entry-runtime/[entryRuntimeRefId]/page.tsx`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `planning/PHASE_12B_INTERNAL_COMMUNICATION_NOTIFICATION_CLASSIFICATION_FOUNDATION.md`

## Phase 12C output summary

Phase 12C adds a lightweight, internal-only notification-candidate evaluation layer on top of existing communication classification metadata. The change is evaluation-only and metadata-only: it introduces no delivery runtime, no messaging/chat runtime, no Feed/Inbox runtime behavior, no guardian runtime communication behavior, and no automation/escalation behavior. Operational workflows, organization scoping, and authorization assumptions remain intact.

## PR Summary

Phase 12C introduces internal notification-candidate evaluation metadata for operational contexts (overdue follow-up, unresolved concern, attendance review, readiness concern, and assignment/update awareness) and surfaces this context on existing staff metadata views only. All runtime communication behavior remains deferred: no reminders, no dispatch queues, no push/email/SMS channels, no Feed/Inbox runtime, no messaging/chat runtime, no guardian runtime communication behavior, and no escalation automation.
