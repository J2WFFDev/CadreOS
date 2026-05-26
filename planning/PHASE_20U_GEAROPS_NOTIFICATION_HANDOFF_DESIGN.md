# Arc 20U — GearOps Notification Handoff Design

## Status

Documentation/design complete.  
No delivery-channel runtime, notification center, preference engine, or external provider integration is introduced in this arc.

## Arc Intent

Arc 20U prepares GearOps to participate in future notification workflows without turning GearOps into the communications engine.

This arc defines:

- notification-worthy GearOps events
- recipient role intent and organization-scoped routing boundaries
- safe payload expectations
- severity and channel-intent metadata
- escalation/suppression/digest candidates
- audit/history linkage guidance
- pending/offline notification behavior
- GearOps vs future communications ownership

This arc explicitly does **not** build:

- email sending
- SMS sending
- push notifications
- in-app notification center behavior
- chat or messaging
- communication campaign tooling
- notification preference UI/runtime
- escalation automation
- digest scheduling
- external provider integrations

---

## 1) Ownership Boundary

### GearOps owns

- identifying notification-worthy operational events
- producing a bounded notification handoff definition
- attaching severity, recipient-role intent, and safe payload metadata
- exposing links back to authoritative GearOps workflow/audit records
- ensuring organization scoping and privacy-safe payload composition
- marking escalation/digest/suppression **candidates** only

### Future communications module owns

- deciding whether a handoff becomes a delivered notification
- delivery channel selection
- message formatting
- delivery timing, retries, and backoff
- digesting and batching
- end-user notification preferences and unsubscribes
- guardian/parent communication policy enforcement
- external provider behavior and delivery receipts

### Key rule

GearOps may say **“this event is notification-worthy”**.  
GearOps must not say **“send this email/SMS/push now.”**

---

## 2) Core Handoff Model

| Concept | Purpose | GearOps responsibility |
| --- | --- | --- |
| `GearNotificationEvent` | Canonical event type identifier for a notification-worthy change | Define stable event names and grouping |
| `GearNotificationTrigger` | The workflow action or state transition that produced the event | Map existing GearOps actions to event types |
| `GearNotificationHandoff` | Bounded handoff object emitted from GearOps | Include safe payload + recipient-role intent |
| `GearNotificationRecipient` | Recipient-role candidate, not a resolved delivery address | Express role intent only |
| `GearNotificationPreference` | Future communications concern | Deferred; GearOps may only expose preference lookup keys |
| `GearNotificationPayload` | Minimal safe event snapshot | Keep payload narrow and privacy-safe |
| `GearNotificationSeverity` | Priority/attention level | Assign bounded severity values |
| `GearNotificationChannelIntent` | Delivery urgency hint only | Express intent such as immediate vs digest candidate |
| `GearNotificationAuditLink` | Reference to authoritative history/audit context | Provide safe reference only |
| `GearNotificationSuppressionRule` | Candidate dedupe/suppression metadata | Mark candidate windows; do not execute policy |
| `GearNotificationEscalationCandidate` | Candidate for future escalation | Mark unresolved high-risk scenarios only |
| `GearNotificationDigestCandidate` | Candidate for batching | Mark low-urgency summary-safe events |
| `GearNotificationPrivacyBoundary` | Payload sensitivity classification | Constrain fields by audience and scenario |

---

## 3) Notification Handoff Lifecycle

1. A GearOps workflow completes a meaningful server-confirmed action or detects a server-confirmed exception.
2. GearOps maps that action/exception to a `GearNotificationEvent`.
3. GearOps builds a `GearNotificationHandoff` with:
   - organization scope
   - event type
   - severity
   - recipient-role intent
   - safe payload
   - audit/history references if allowed
   - optional suppression/escalation/digest hints
4. GearOps exposes that handoff to a future communications boundary.
5. The future communications module decides whether to deliver, defer, batch, suppress, or ignore it.

No delivery-channel assumption is made at step 4.

---

## 4) Severity Model

| Severity | Meaning | Typical GearOps use |
| --- | --- | --- |
| `INFO` | Informational state change with no immediate intervention required | check-in completed, maintenance completed, gear staged |
| `ACTION_NEEDED` | Follow-up expected soon | guardian approval needed, reservation expiring, inspection due |
| `WARNING` | Operational risk or conflict exists | damaged item, limited-use item, import completed with errors |
| `URGENT` | Time-sensitive issue with meaningful operational impact | missing/unreturned gear, readiness issue before event |
| `BLOCKER` | Current workflow or event readiness is materially blocked | reservation/hold conflict blocking deployment, out-of-service item on required event plan |

Severity is descriptive metadata only.  
It does not imply a specific channel, timing, or escalation behavior.

---

## 5) Channel-Intent Boundary

Suggested `GearNotificationChannelIntent` values:

- `IMMEDIATE_CANDIDATE`
- `DIGEST_CANDIDATE`
- `IN_APP_REVIEW_CANDIDATE`
- `ADMIN_REVIEW_CANDIDATE`
- `NO_DELIVERY_ASSUMPTION`

GearOps may assign one or more intents as routing hints, but a future communications module remains authoritative.

Examples:

- Missing/unreturned gear → `IMMEDIATE_CANDIDATE`
- Inspection due soon → `DIGEST_CANDIDATE`
- Import completed with errors → `ADMIN_REVIEW_CANDIDATE`
- Offline action needs review → `IN_APP_REVIEW_CANDIDATE`

---

## 6) Recipient Role Logic

Recipient logic must stay **role-aware**, **organization-scoped**, and **permission-safe**.

| Recipient role intent | When it is a candidate | Notes |
| --- | --- | --- |
| Current custody holder | Checkout/check-in/custody changes, overdue/unreturned reminders, damage/missing follow-up | Use only when custody holder is known and in-org |
| Prior custody holder | Custody transfer, discrepancy follow-up, return accountability review | Usually internal/staff review only |
| Assigned person / athlete | Assignment change, reservation fulfillment, readiness impact on their assigned gear | Keep payload minimal for athlete-facing futures |
| Responsible coach / adult | Athlete assignment changes, approval-needed cases, readiness risks, missing/unreturned gear | Often safer than direct athlete routing for action-oriented events |
| Equipment cage / vault operator | Hold creation, reservation conflict, staging/deployment/recovery exceptions, identifier warnings | Operational staff audience |
| Event gear lead | Event plan incomplete, readiness issue, staged/deployed/recovered exceptions | Event-scoped role candidate |
| Event owner / manager | Event readiness blockers, event deployment/recovery issues, reservation conflicts affecting event execution | Event responsibility boundary |
| Administrator | Import errors, duplicate identifiers, policy violations, out-of-service blockers, unresolved offline issues | Org-scoped admin audience |
| Maintenance owner | Maintenance intake/completion, inspection failed/due, damage/out-of-service/limited-use status | Maintenance workflow audience |
| Guardian / parent | Approval-needed or approval-result scenarios only when policy allows | No direct delivery decision in GearOps |
| Power user / program manager | Cross-cutting readiness, repeated conflicts, trend-worthy exception clusters | Candidate audience for summary/digest views |

### Recipient resolution rules

- Role intent must resolve only within the same organization scope as the triggering record.
- Recipient intent may include multiple candidate roles for the same event.
- GearOps should prefer operationally responsible adults/staff when audience ambiguity exists.
- Guardian/parent intent must be treated as **policy-gated** and **future-communications-owned**.

---

## 7) Notification-Worthy Event Catalog

### A) Custody / Assignment

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Gear checked out | `INFO` | current custody holder, responsible coach/adult, cage operator | Action confirmation only |
| Gear checked in | `INFO` | prior/current custody holder, cage operator | Safe custody completion event |
| Custody transfer | `ACTION_NEEDED` | current custody holder, prior custody holder, cage operator | Useful for accountability transitions |
| Assignment change | `INFO` | assigned person/athlete, responsible coach/adult, administrator | Role-aware and assignment-scoped |
| Gear missing/unreturned | `URGENT` | current/prior custody holder, responsible coach/adult, administrator | Strong escalation candidate |

### B) Guardian Approval

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Guardian approval needed | `ACTION_NEEDED` | responsible coach/adult, administrator, guardian/parent | Guardian routing remains policy-gated |
| Guardian approval completed | `INFO` | responsible coach/adult, administrator | Safe status-change event |
| Guardian approval denied | `WARNING` | responsible coach/adult, administrator | Can block downstream issue/assignment flow |

### C) Reservation / Hold

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Gear reserved | `INFO` | assigned person/athlete, event gear lead, cage operator | Reservation confirmation |
| Gear hold created | `ACTION_NEEDED` | cage operator, administrator, event gear lead | Operational awareness |
| Reservation/hold conflict | `BLOCKER` | event gear lead, event owner/manager, cage operator, administrator | Strong blocker signal |
| Reservation/hold expiring | `ACTION_NEEDED` | event gear lead, responsible coach/adult, cage operator | Digest or immediate candidate based on timing |
| Hold released / reservation fulfilled | `INFO` | event gear lead, cage operator | Low urgency completion event |

### D) Event Operations

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Gear staged for event | `INFO` | event gear lead, event owner/manager, cage operator | Operational progress signal |
| Gear deployed to event | `INFO` | event gear lead, event owner/manager | Deployment confirmation |
| Gear returned/recovered | `INFO` | event gear lead, cage operator | Recovery completion |
| Event gear readiness issue | `URGENT` | event gear lead, event owner/manager, administrator | Escalation candidate when near start time |
| Event gear plan incomplete | `ACTION_NEEDED` | event gear lead, event owner/manager | Digest candidate until time-sensitive |

### E) Readiness / Maintenance / Condition

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Gear marked damaged | `WARNING` | maintenance owner, current custody holder, administrator | Route carefully to avoid over-sharing details |
| Gear marked out of service | `BLOCKER` | maintenance owner, event gear lead, administrator | Readiness-blocking event |
| Gear marked limited use | `WARNING` | maintenance owner, responsible coach/adult, event gear lead | Usage restriction awareness |
| Maintenance intake created | `ACTION_NEEDED` | maintenance owner, administrator | Work intake candidate |
| Maintenance completed | `INFO` | maintenance owner, administrator, event gear lead | Completion notice |
| Inspection due | `ACTION_NEEDED` | maintenance owner, administrator | Often digest-safe until deadline nears |
| Inspection failed | `URGENT` | maintenance owner, administrator, event gear lead | Readiness-impacting event |

### F) Consumables

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Consumable low threshold reached | `WARNING` | cage operator, administrator, power user/program manager | Suppression candidate to avoid spam |
| Consumable insufficient for event plan | `URGENT` | event gear lead, event owner/manager, administrator | Event readiness risk |
| Consumable event adjustment recorded | `INFO` | event gear lead, cage operator | Digest-safe operational update |

### G) Mobile / Offline / Pending Actions

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Pending/offline action failed | `WARNING` | current operator review audience, administrator | Only after server-confirmed failure/reconcile result |
| Pending/offline action needs review | `ACTION_NEEDED` | current operator review audience, administrator | In-app/admin review candidate |
| Online-required action blocked | `ACTION_NEEDED` | current operator review audience | Local UX continuity signal, not final history |

### H) Admin / Data Operations

| Event | Default severity | Primary recipient intents | Notes |
| --- | --- | --- | --- |
| Import completed | `INFO` | administrator, power user/program manager | Summary-safe event |
| Import completed with errors | `WARNING` | administrator, power user/program manager | Admin review candidate |
| Label/identifier missing | `ACTION_NEEDED` | cage operator, administrator | Safe operational cleanup signal |
| Duplicate identifier warning | `WARNING` | cage operator, administrator | Strong suppression/dedupe handling needed |

---

## 8) Payload Guidance

Recommended `GearNotificationPayload` shape:

```ts
type GearNotificationPayload = {
  organizationId: string;
  eventType: GearNotificationEvent;
  occurredAt: string;
  severity: GearNotificationSeverity;
  channelIntents: GearNotificationChannelIntent[];
  safeDisplayLabel: string;
  actionNeeded: string | null;
  currentStatus: string | null;
  routeTarget: {
    kind: "gear-item" | "event-gear" | "reservation" | "maintenance" | "import-job" | "admin-review";
    id: string;
  } | null;
  gearItemRef: {
    id: string;
    itemLabel: string;
    categoryName: string | null;
  } | null;
  relatedRefs: {
    eventId?: string;
    assignmentId?: string;
    checkoutId?: string;
    reservationId?: string;
    holdId?: string;
    maintenanceLogId?: string;
    importJobId?: string;
  };
  recipientRoleIntents: string[];
  auditLink: GearNotificationAuditLink | null;
  privacyBoundary: GearNotificationPrivacyBoundary;
  suppressionKey: string | null;
  escalationCandidate: boolean;
  digestCandidate: boolean;
};
```

### Payload must include only what is necessary

- organization identifier/reference
- event type
- event time
- severity
- current status/action-needed summary
- safe display label
- route/link target
- recipient role intent
- bounded audit/history reference when allowed

### Payload must avoid

- private journal/note body content
- sensitive staff notes
- medical or personal information
- unnecessary athlete or guardian details
- unrelated audit history
- exact custody/location detail for unauthorized audiences
- contact addresses, phone numbers, or provider-specific delivery metadata

---

## 9) Privacy and Safety Boundary

### Default privacy posture

- Minimal payload by default
- Staff-safe operational language
- Reference-first identifiers instead of expanded private data
- Recipient filtering before any future delivery decision

### `GearNotificationPrivacyBoundary` guidance

Suggested values:

- `STAFF_OPERATIONAL`
- `ROLE_LIMITED_OPERATIONAL`
- `GUARDIAN_POLICY_GATED`
- `ADMIN_REVIEW_ONLY`

Use cases:

- Missing/unreturned gear → usually `STAFF_OPERATIONAL`
- Athlete assignment change → often `ROLE_LIMITED_OPERATIONAL`
- Guardian approval needed → `GUARDIAN_POLICY_GATED`
- Import errors / duplicate identifiers → `ADMIN_REVIEW_ONLY`

### Safe display expectations

Safe display labels should prefer:

- gear item name
- category
- event name
- simple state summary

Safe display labels should avoid:

- staff-only explanation text
- private relationship details
- freeform internal note content
- unbounded location chains or custody history

---

## 10) Guardian / Parent Boundary

Guardian/parent notification behavior is explicitly bounded.

GearOps may:

- identify that guardian approval status is relevant
- mark guardian/parent as a **candidate recipient role**
- include only the minimum approval-state summary needed for routing

GearOps must not:

- decide that a guardian message should actually be sent
- resolve or expose private guardian contact details in the handoff payload
- include private athlete notes, staff-only notes, or unrelated history
- implement guardian preference, consent, or unsubscribe behavior

### Guardian-safe rule

If guardian participation is relevant, GearOps should emit a policy-gated handoff that says:

- approval is needed / completed / denied
- which assignment or item is affected
- which safe route target should be reviewed

The communications module must decide if guardian delivery is allowed.

---

## 11) Audit / History Relationship

Authoritative operational history remains in existing GearOps records:

- assignments
- checkouts/check-ins
- reservations/holds
- maintenance/inspection logs
- inventory movements
- imports/admin review records

The notification handoff is **not** the source of truth for history.

### `GearNotificationAuditLink` should be used for

- linking a notification-worthy event back to the authoritative record
- supporting staff review context
- enabling future communication logs to reference the originating operational event

### `GearNotificationAuditLink` should not be used for

- exposing full audit history payloads
- duplicating large workflow snapshots
- bypassing access rules on underlying records

Suggested fields:

- source model type
- source record id
- organization id
- allowed route target
- visibility/privacy boundary

---

## 12) Pending / Offline Behavior

Pending/offline behavior must remain conservative.

### Rules

1. Do **not** emit “success” notification handoffs for offline actions until the server confirms the action.
2. Local pending actions may surface operator-visible status, but they are not authoritative notification events yet.
3. Emit notification handoff candidates only when reconciliation determines:
   - the action failed, or
   - the action needs review, or
   - an online-required action was blocked and requires follow-up
4. Future communications delivery must treat offline-originated handoffs as idempotency-sensitive.

### Why this matters

Without this boundary, GearOps could create false positive notifications for actions that never actually finalized.

### Design implication for Arc 20V

Offline sync phase 2 should define:

- replay/idempotency policy for handoff emission
- conflict resolution behavior when pending actions mutate the same gear item
- whether failed reconciliations create one handoff or update an existing review item

---

## 13) Suppression, Digest, and Escalation Candidates

These remain metadata only in Arc 20U.

### Suppression candidates

Use when repeated events could create noise:

- repeated low-threshold consumable warnings for the same item/category window
- duplicate identifier warnings triggered repeatedly before cleanup
- repeated reservation-expiring reminders within a short interval

### Digest candidates

Use when batching is reasonable:

- inspection due soon
- maintenance completed
- gear staged/deployed/recovered progress signals
- import completed successfully

### Escalation candidates

Use when the issue is meaningful but escalation policy should remain deferred:

- missing/unreturned gear still unresolved after a policy window
- event readiness issue close to start time
- blocker-level reservation conflict on critical event gear
- repeated offline action failure on the same operational workflow

No automated escalation execution is introduced here.

---

## 14) Integration Guidance

If future lightweight runtime hooks are added, they should follow existing GearOps patterns:

- emit handoff metadata only after server-confirmed state changes
- keep hooks organization-scoped
- keep payload generation in GearOps service-layer boundaries, not UI-only code
- prefer typed event contracts over provider-specific formatting
- preserve graceful fallback when adjacent modules are unavailable

Possible future integration points:

- checkout/check-in service completion
- assignment mutation completion
- reservation/hold conflict evaluation
- event readiness evaluation
- maintenance/inspection mutation completion
- import summary finalization
- pending-action reconciliation outcome handling

---

## 15) Deferred Scope Confirmation

Arc 20U intentionally defers:

- actual delivery orchestration
- notification center surfaces
- user preference storage and UX
- guardian communication policy execution
- external provider integration
- delivery analytics/receipts
- campaign/broadcast messaging
- automation rules and escalation engines
- digest schedulers

This remains a design/integration-readiness arc only.

---

## 16) Recommended Follow-On Sequencing

### Immediate next recommendation: Arc 20V

Arc 20V should focus on offline sync phase 2 design before any deeper notification runtime is attempted.

Why:

- pending/offline state is the biggest source of false-positive or duplicate handoff risk
- replay/idempotency rules need definition before notification hooks can be trusted
- conflict-resolution policy affects when a notification-worthy event is considered final

### After 20V

Recommended path:

1. **Arc 20V — Offline sync phase 2 design**
   - finalize pending-action replay/conflict policy
2. **Communications policy/consent boundary arc**
   - lock guardian delivery, consent, unsubscribe, and audience-governance rules
3. **Future communications implementation arc**
   - consume GearOps handoffs and decide actual delivery behavior

---

## 17) Definition of Done Coverage

Arc 20U is complete when:

- GearOps has a documented notification handoff model.
- Notification-worthy events are defined and grouped.
- Recipient role logic is documented and organization-scoped.
- Severity guidance is documented.
- Payload safety boundaries are explicit.
- Guardian/parent communication boundaries are explicit.
- GearOps vs communications ownership is clear.
- Pending/offline notification behavior is documented.
- Delivery-channel scope remains deferred.

---

## Source References

- `planning/PHASE_12B_INTERNAL_COMMUNICATION_NOTIFICATION_CLASSIFICATION_FOUNDATION.md`
- `planning/PHASE_17G_GUARDIAN_RELATIONSHIP_MAINTENANCE.md`
- `planning/PHASE_20M_GEAROPS_CROSS_MODULE_INTEGRATION_READINESS.md`
- `planning/PHASE_20N_GEAROPS_RELEASE_CANDIDATE_STABILIZATION.md`
- `planning/PHASE_20Q_GEAROPS_ROADMAP_PARKING_LOT_AND_DEFERRED_SCOPE_CLEANUP.md`
- `planning/PHASE_20R_GEAROPS_PILOT_TEST_PLAN_AND_FEEDBACK_INSTRUMENTATION.md`
- `planning/PHASE_20S_GEAROPS_IMPORT_EXPORT_AND_QR_LABEL_OPERATIONS.md`
