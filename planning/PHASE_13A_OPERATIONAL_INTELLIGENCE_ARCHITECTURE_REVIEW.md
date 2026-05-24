# Phase 13A — Operational Intelligence Architecture Review

## Goal

Define Operational Intelligence architecture boundaries before implementing analytics,
recommendations, AI assistance, or automation behavior. This phase is
documentation and architecture review only: no runtime intelligence, no recommendation
engine, no workflow automation, no autonomous operational actions, no guardian-facing
intelligence behavior, and no Feed or Inbox runtime behavior are introduced.

## Scope Guardrails (enforced)

- Do not implement AI runtime behavior.
- Do not implement recommendation engines.
- Do not implement workflow automation.
- Do not implement autonomous operational actions.
- Do not implement guardian-facing intelligence behavior.
- Do not implement Feed or Inbox runtime behavior.
- Keep this phase architecture/review focused.
- Preserve organization scoping and authorization behavior.
- Do not introduce new major dependencies.

---

## Reviewed Runtime Baseline (Arcs 8–12)

### Operational workflow models currently implemented

| Model | Description |
|-------|-------------|
| `ObservationNote` | Staff-authored operational notes with readiness status, person/team/event context, visibility classification, and unresolved follow-up linkage. Authoritative for note content. |
| `FollowUpTask` | Task records with status, due date, assignee, team/event/note context, and ownership indicators. Authoritative for follow-up execution. |
| `AttendanceRecord` + `RSVP` | Attendance captures with status, event linkage, roster context, and attendance-gap follow-up continuity. |
| `EntryRuntimeRef` | Additive sidecar wrapper linking notes and tasks to a lightweight Entry traceability model. Read-only context only; does not replace or migrate note/task authority. |
| `OperationalHistoryItem` | Derived read-model composed from tasks, notes, attendance, event, and roster events with communication classification and notification-candidate metadata (Phase 12B/12C). |
| `OperationalAwarenessView` | Pure-function grouping of candidate-classified history items by awareness category (Phase 12D). Staff-internal, read-only, non-delivery. |

### Auth / scoping baseline relevant to intelligence

- Organization scope is resolved through `getOrganizationScope()` and used as the base
  boundary for all operational data access.
- Staff-gated authorization helpers (`resolveStaffScopeResolution`,
  `evaluateStaffOnlyContentAccess`) gate all operational content access.
- Guardian relationship visibility remains staff-diagnostic only; guardian data must not
  enter any intelligence surface.
- `lib/operational-awareness.ts` is a pure transformation; upstream callers are
  responsible for all authorization filtering before passing history items.
- Existing operational visibility helpers (`lib/operational-visibility.ts`) gate
  note/task source model visibility in the history query layer.

### Communication-awareness baseline (Arc 12 output)

- Classification metadata (`lib/communication-classification.ts`): internal-only
  category taxonomy and candidate types, all marked `internalOnly`, `deliveryDeferred`,
  `messagingDeferred`, `guardianCommunicationDeferred`.
- Awareness grouping (`lib/operational-awareness.ts`): pure-function read-model,
  staff-scoped, non-Inbox, non-Feed, non-delivery, no new DB queries.
- All runtime delivery, messaging, Feed/Inbox, guardian communication, and automation
  behavior remains deferred and explicitly blocked.

---

## Current Operational Data Available for Intelligence

The following data sources are already present in the runtime and may be used as
input to future read-model intelligence surfaces, subject to the authorization and
scoping rules described above.

### 1) ObservationNote context

- Note content, readiness status (`OperationalReadinessStatus`), author attribution,
  creation/update timestamps, resolved/unresolved state, and person/team/event linkage.
- Notes carry visibility classification (`STAFF_ONLY`, `INTERNAL`) and entry wrapper
  traceability.
- Unresolved linked tasks are surfaced per note.
- **Intelligence opportunity:** per-person/team/program unresolved note counts, stale
  note detection (high `updatedAt` age without resolution), and note-authorship
  coverage gaps.

### 2) FollowUpTask context

- Task status (`OPEN`, `IN_PROGRESS`, `BLOCKED`, `RESOLVED`), due date, assignee
  person, creation/update timestamps, team/event/note linkage, and ownership
  indicators.
- Overdue and unresolved tasks are classified as notification candidates (Phase 12C).
- **Intelligence opportunity:** task resolution rate per team/assignee/program/season,
  overdue task volume trends, blocked task clusters indicating systemic friction, and
  missing-assignee ownership gaps.

### 3) Attendance context

- `AttendanceRecord` status, event linkage, person/team context, and capture
  timestamps.
- `RSVP` availability signals per person/event.
- Attendance records flagged for review are classified as notification candidates
  (Phase 12C).
- **Intelligence opportunity:** attendance rate summaries per person/team/event window,
  declining attendance trend detection, consecutive-absence flags, and attendance gap
  correlation with unresolved notes.

### 4) Entry wrapper / context behavior

- `EntryRuntimeRef` provides lightweight traceability across note/task pairs.
- Read-only entry relationship view surfaces cross-linked note/task context (Phase 10D).
- Entry wrapper context is additive metadata only; note/task authority is unchanged.
- **Intelligence opportunity:** entry-linked note+task co-occurrence summaries, and
  cross-linked operational item counts per person/team as a resolution coverage signal.

### 5) Operational awareness metadata (Phases 12B–12C)

- Communication category classifications: `operational_update`,
  `follow_up_reminder_candidate`, `attendance_concern`, `readiness_concern`,
  `assignment_update_event`, `informational_operational_event`.
- Notification candidate types: `overdue_follow_up_candidate`,
  `unresolved_operational_concern_candidate`, `attendance_review_candidate`,
  `readiness_concern_candidate`, `assignment_update_awareness_candidate`.
- All metadata is explicitly internal-only and delivery-deferred.
- **Intelligence opportunity:** candidate type distribution over time provides a
  lightweight proxy for organizational operational health trending without requiring
  new data collection.

### 6) Roster / member context

- Team membership (`TeamMembership`), role assignments (`RoleAssignment`),
  guardian relationship linkage (`AthleteGuardianRelationship` — staff-diagnostic
  only), and program/season enrollment context.
- Roster changes are classified as assignment/update awareness events.
- **Intelligence opportunity:** roster coverage completeness signals (e.g., athletes
  missing guardian linkage, roles without adequate coverage), team size relative to
  upcoming event load, and assignment/role-change velocity as a workload signal.

---

## Operational Intelligence Concept Definitions

### Operational Summaries

**What they are:** Read-model aggregations of already-collected operational records,
expressed as counts, rates, or state distributions at a given point in time. No
inference or prediction. Examples:
- Count of open tasks per team/person.
- Attendance rate for a person over the last N events.
- Distribution of note readiness statuses per team this week.

**What they are not:** Notifications, recommendations, escalation triggers, or
AI-generated narrative summaries.

**Authorization boundary:** Must apply the same staff-only, organization-scoped
filters as operational history queries. Summary surfaces must never expose cross-scope
or guardian-linked sensitive content.

### Readiness Evaluation Concepts

**What they are:** Deterministic, rule-based evaluations of whether an operational
entity (person, team, event, season) meets a defined readiness threshold based on
existing data signals. Examples:
- "Event readiness: 3 of 7 team members have unresolved notes" — derived from existing
  task/note status.
- "Person readiness concern: unresolved attendance flag + overdue task" — derived from
  existing candidate classification.
- `OperationalReadinessStatus` on notes provides the raw signal foundation.

**What they are not:** Predictive models, ML-scored evaluations, autonomous
pass/fail decisions, or guardian-visible readiness scores.

**Authorization boundary:** Readiness evaluation must never produce output visible
to guardian users. Staff-only. Organization-scoped.

### Trend Analysis Concepts

**What they are:** Time-windowed comparisons of existing operational signals
(e.g., task resolution rate this week vs. previous two weeks, attendance rate over
the last 4 events vs. 4 events before that). All derived from existing records.
No new data collection required.

**What they are not:** ML-based predictive forecasting, anomaly detection engines,
or automated alert dispatch based on trend thresholds.

**Authorization boundary:** Trend analysis surfaces must never include guardian
data or cross-scope data. Staff-only, organization-scoped.

### Workload Visibility Concepts

**What they are:** Aggregate indicators of staff operational burden relative to
open/unresolved work. Examples:
- Open task count per assignee.
- Events with unresolved attendance concerns this week.
- Note authorship frequency per staff member vs. team coverage.

**What they are not:** Automated task rebalancing, workload assignment recommendations,
or performance evaluation outputs.

**Authorization boundary:** Workload visibility must not expose individual staff
performance data beyond what staff can already see in existing task/note list surfaces.

### Unresolved Operational Concern Analysis

**What they are:** Consolidated views of items flagged as unresolved across the
awareness candidate taxonomy (overdue follow-up, unresolved concern,
attendance review, readiness concern, assignment/update). Groups and counts items by
entity (person, team, event) for staff triage prioritization. Extends the existing
`OperationalAwarenessView` concept into entity-scoped summaries.

**What they are not:** Escalation queues, automated follow-up dispatch, or
AI-inferred severity scoring.

**Authorization boundary:** Must respect existing `buildOperationalAwarenessView`
preconditions: upstream authorization filtering required before passing items.

### Recommendation Boundaries

**What operational intelligence may suggest (read-model indicators only):**
- "This team has N unresolved items — consider a review pass" (count-based signal,
  surfaced as a staff-visible indicator only).
- "This person has had declining attendance over the last 4 events" (computed rate,
  presented as a data point for staff judgment).
- "This assignee has N overdue tasks" (aggregate count, linked to task list filter
  for staff action).

**What operational intelligence must never do:**
- Automatically create tasks, notes, or records without explicit staff action.
- Send or schedule notifications, reminders, or escalations.
- Expose indicators to guardian users.
- Assign severity or urgency labels that override staff judgment.
- Produce AI-generated narrative text for staff consumption without an explicit
  content-safety and governance review gate.

---

## Boundary Definitions (Must Remain Separate)

### 1) Operational intelligence vs. automation

- **Operational intelligence** = read-model computation over existing data; staff sees
  the output and decides what to do.
- **Automation** = system takes operational action (creates records, routes work,
  dispatches messages) without a staff action step.
- These must never be combined in a single runtime surface without an explicit arc
  gate review separating the read surface from the action trigger.

### 2) Operational summaries vs. notifications

- **Summaries** = derived aggregates surfaced in a staff-facing dashboard section;
  no delivery, no dispatch, no persistence of the summary as a record.
- **Notifications** = delivery-dispatched, persisted, recipient-targeted events with
  acknowledgement/delivery-state semantics.
- Summary surfaces must not evolve into notification dispatch surfaces without a
  full communications architecture gate review (Arc 12 prerequisites).

### 3) Recommendations vs. workflow execution

- **Recommendations** = text or indicator surfaced for staff review; the staff member
  decides whether to act.
- **Workflow execution** = system takes an action (task assignment, roster change,
  note creation) on behalf of staff.
- No intelligence surface in Arc 13 may take a workflow action. All intelligence
  output is read-model and advisory only.

### 4) Awareness vs. escalation

- **Awareness** = staff sees a grouped indicator of unresolved/concerning items;
  they triage at their own discretion.
- **Escalation** = system routes, elevates, or notifies based on a policy threshold
  without a staff action step.
- Arc 13 must not introduce any escalation policy evaluation, escalation routing,
  or escalation dispatch behavior.

---

## Operational Intelligence Risk Areas

### 1) Misleading summaries

**Description:** Aggregate summaries (e.g., "3 unresolved concerns") computed from
incomplete or stale data can give staff a false sense of coverage completeness or
urgency that does not reflect actual operational state.

**Mitigations to design in:**
- Surface data-freshness context alongside summaries (e.g., window used, query
  timestamp).
- Explicitly label summaries as "based on available records" rather than as
  authoritative assessments.
- Preserve direct links to source records so staff can verify the underlying data.
- Do not suppress or omit items from summaries without an explicit, visible filter
  control.

### 2) Recommendation overreach

**Description:** Even read-model recommendations surfaced as "suggested actions" can
subtly override staff judgment if phrased as directives or if the recommendation
surface is prominent enough to feel mandatory.

**Mitigations to design in:**
- Label all indicators and suggestions explicitly as informational, not directive.
- Keep recommendation surfaces clearly subordinate to operational list/detail
  surfaces in information hierarchy.
- Do not surface the same recommendation repeatedly (avoid re-surfacing suppressed
  or acknowledged items — design for eventual per-user dismissal).
- Establish a recommendation content review gate before any AI-generated text is
  introduced.

### 3) Authorization leakage

**Description:** Intelligence surfaces that aggregate data across multiple records
may inadvertently surface cross-scope or guardian-linked data if upstream authorization
filtering is applied inconsistently.

**Mitigations to design in:**
- All intelligence computation functions must be pure transformations that operate
  only on pre-authorized, pre-scoped input data.
- No intelligence function may perform its own database query; all DB access must
  occur in the caller (which applies organization scope and staff-role checks).
- Add explicit caller-responsibility documentation to every intelligence helper,
  consistent with the pattern established in `lib/operational-awareness.ts`.
- Add an authorization boundary validation note to every new intelligence panel
  component.

### 4) False urgency

**Description:** Displaying operational counts, unresolved item totals, or trend
indicators using alert-like visual styling (red badges, warning icons, "urgent" labels)
can create a sense of urgency that is not actually justified by the underlying data,
leading to attention fatigue or anxiety-driven operational decisions.

**Mitigations to design in:**
- Use neutral visual styling for count indicators; reserve warning-level styling only
  for items that have a deterministic, rule-based, threshold-crossed signal (e.g.,
  explicitly overdue tasks, not "may be a concern").
- Do not use language like "urgent," "critical," or "escalate" on intelligence surfaces
  unless the underlying data explicitly supports that classification under a defined rule.
- Establish a visual styling convention for intelligence indicators separate from
  error/system-status styling conventions.

### 5) Trust erosion

**Description:** If intelligence surfaces produce incorrect aggregations, surface stale
data, or recommend actions that turn out to be inappropriate, staff trust in both the
intelligence surface and the broader CadreOS platform degrades.

**Mitigations to design in:**
- Launch intelligence surfaces with conservative, clearly scoped signals (counts,
  rates, explicit rule-based flags) before any inferred or AI-generated signals.
- Make the computation logic for any indicator visible to product reviewers and
  accessible for audit.
- Avoid introducing intelligence signals that cannot be explained in plain language
  by a staff-facing label or tooltip.
- Establish a signal deprecation path: if a signal proves misleading in practice,
  it must be removable without breaking other surfaces.

---

## Do Not Implement Yet

The following behaviors carry unacceptable risk, unresolved governance requirements,
or prerequisite architecture gaps that block safe introduction in Arc 13.

### Autonomous actions

- No system-initiated task creation, task assignment, or note creation.
- No automatic roster changes or event modifications.
- No automated form submissions or workflow state transitions.
- No action taken by the system without an explicit staff-initiated trigger.

### AI-generated escalation

- No policy evaluation engine that promotes items to "escalated" status.
- No escalation routing (e.g., automatically assigning an item to a supervisor).
- No scheduled escalation reminder dispatch.
- No AI-inferred severity scoring that triggers a system workflow.

### Guardian-facing AI summaries

- No intelligence output visible to guardian users of any kind.
- No AI-generated summaries derived from staff-only operational context that are
  exposed through guardian-facing surfaces.
- No guardian readiness or attendance interpretation surfaces.
- Guardian relationship linkage alone does not grant intelligence surface access.

### Predictive discipline scoring

- No model-based discipline risk score, behavioral risk indicator, or similar
  predictive performance label for any athlete or guardian.
- No ranking of athletes, teams, or guardians by predicted future behavior.
- This category requires dedicated data governance, bias review, consent architecture,
  and legal/policy review before any design work begins.

### Automated coaching recommendations

- No AI-generated coaching recommendations surfaced to staff.
- No automated suggestions for training modifications, drill adjustments, or
  player position changes.
- No AI-authored note or task content injected into staff workflows.
- This category requires governance model review, output-safety boundary definition,
  and domain expert validation before any design work begins.

---

## Safe First Intelligence Slice (Recommendation)

**Recommended first intelligence surface:** A lightweight, staff-only, organization-scoped
**Operational Summary Panel** that aggregates already-collected operational data into
a small set of deterministic, count-based indicators surfaced on the existing staff
dashboard.

### Candidate indicators for the first safe slice

| Indicator | Source data | Computation | Display |
|-----------|-------------|-------------|---------|
| Open task count | `FollowUpTask` (status OPEN/IN_PROGRESS/BLOCKED) | Count with optional team/assignee filter | Staff dashboard, linked to filtered task list |
| Overdue task count | `FollowUpTask` (status in unresolved, dueDate < today) | Count | Staff dashboard, linked to filtered task list |
| Unresolved note concern count | `ObservationNote` (readiness status = CONCERN or UNRESOLVED) | Count per org/team scope | Staff dashboard, linked to filtered notes list |
| Attendance concern count (last 30 days) | `AttendanceRecord` (status flagged/review) | Count over window | Staff dashboard, linked to attendance review |
| Recent assignment/roster changes | `TeamMembership` / `RoleAssignment` (updatedAt < N days) | Count | Staff dashboard, linked to team roster view |

### Why this slice is safe

- All indicators are deterministic counts over existing data with no inference.
- Computation is a pure read-model transformation over already-authorized query results.
- No new schema changes required.
- No delivery behavior, no notification dispatch, no guardian exposure.
- Output is a set of staff-visible numbers linked directly to existing operational
  surfaces, not a standalone intelligence product.
- Fully reversible: removing the summary panel restores the previous dashboard state
  without any data or workflow impact.

### What keeps this slice bounded

- Each indicator must be backed by a documented rule: what records it counts, what
  filter window applies, and what "unresolved" or "concerning" means in rule terms.
- The panel must display a data-freshness label (query window and generation time).
- The panel must not render if the upstream data fetch fails; graceful omission is
  required.
- The panel must not introduce any new authorization logic; all filters must use
  existing organization scope and staff-role check patterns.

---

## Blocking Before Runtime Intelligence Checklist

The following gates must be satisfied before any runtime Operational Intelligence
surface is implemented beyond the architecture review deliverable.

- [ ] Confirm that `lib/operational-awareness.ts` caller-responsibility preconditions
      are documented inline and that all existing callers apply upstream authorization
      filtering before passing history items.
- [ ] Confirm that no intelligence surface can be reached by a guardian-authenticated
      user under any current or planned route configuration.
- [ ] Confirm that communication-awareness candidate type registry is stable enough
      to serve as the input taxonomy for intelligence indicators (or document where it
      diverges).
- [ ] Define the visual styling convention for intelligence indicators (count badges,
      trend labels) separate from error/system-status styling, and document this in a
      UI convention reference.
- [ ] Define the "indicator rule card" documentation format: for each indicator, the
      rule card must specify source model, filter window, status filter, null/empty
      behavior, and display label.
- [ ] Complete rule cards for all candidate indicators in the "Safe First Intelligence
      Slice" before any implementation begins.
- [ ] Confirm that no intelligence computation function performs its own DB query
      (all must be pure transformations over pre-fetched, pre-authorized data).
- [ ] Confirm that Arc 13 scope does not introduce any AI-generated text, predictive
      scoring, recommendation directives, autonomous action triggers, or escalation
      routing — document the confirmation in the first Arc 13 implementation phase.
- [ ] Confirm that the communications architecture prerequisites (Arc 12 blocking
      checklist) remain satisfied and that no intelligence surface inadvertently
      introduces delivery or notification behavior.
- [ ] Review production risk areas from this document with the team before shipping
      any intelligence surface to a pilot organization.

---

## Validation Guidance

- Confirm the architecture review reflects actual implemented runtime/auth behavior
  (verified against `lib/operational-awareness.ts`, `lib/communication-classification.ts`,
  `lib/operational-history.ts`, `lib/guardian-operational-context.ts`, and Arc 8–12
  planning documents).
- Confirm no runtime intelligence or AI behavior was added in this phase.
- Confirm no workflow automation behavior was added in this phase.
- Confirm no Feed or Inbox runtime behavior was added in this phase.
- Runtime code was not touched; `npm run typecheck` / `npm run build` are not required
  for this phase output.

---

## Source References

- `lib/operational-awareness.ts`
- `lib/communication-classification.ts`
- `lib/operational-history.ts`
- `lib/guardian-operational-context.ts`
- `lib/operational-visibility.ts`
- `components/dashboard/operational-awareness-panel.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `planning/PHASE_8P_OPERATIONAL_FOUNDATION_MVP_CLOSEOUT.md`
- `planning/PHASE_10E_ENTRY_RUNTIME_STABILIZATION_CLOSEOUT.md`
- `planning/PHASE_11C_PILOT_STABILITY_CLOSEOUT_OPERATIONAL_READINESS_REVIEW.md`
- `planning/PHASE_12A_COMMUNICATION_COORDINATION_ARCHITECTURE_BOUNDARIES.md`
- `planning/PHASE_12B_INTERNAL_COMMUNICATION_NOTIFICATION_CLASSIFICATION_FOUNDATION.md`
- `planning/PHASE_12C_INTERNAL_NOTIFICATION_CANDIDATE_EVALUATION_FOUNDATION.md`
- `planning/PHASE_12D_INTERNAL_OPERATIONAL_AWARENESS_VIEW.md`
- `planning/PHASE_12E_COMMUNICATION_AWARENESS_STABILIZATION_CLOSEOUT.md`

---

## PR Summary

Phase 13A defines Operational Intelligence architecture boundaries before any runtime
analytics, recommendation, AI assistance, or automation behavior is introduced. This
phase is documentation-only: no runtime code was added or modified.

### Findings

1. **Operational data is ready for safe read-model intelligence.** Six categories of
   already-collected operational data (ObservationNotes, FollowUpTasks, attendance
   context, Entry wrapper traceability, communication-awareness metadata, and roster/
   member context) provide a sufficient foundation for a conservative first
   intelligence surface without requiring new data collection or schema changes.

2. **Boundary definitions are clear.** Four critical boundaries are explicitly defined
   and must be maintained throughout Arc 13:
   - operational intelligence vs. automation
   - operational summaries vs. notifications
   - recommendations vs. workflow execution
   - awareness vs. escalation

3. **Five risk areas require active mitigation.** Misleading summaries, recommendation
   overreach, authorization leakage, false urgency, and trust erosion are each
   analyzed with design-level mitigation requirements that must be incorporated into
   any runtime intelligence implementation.

4. **Five categories of behavior remain explicitly deferred.** Autonomous actions,
   AI-generated escalation, guardian-facing AI summaries, predictive discipline
   scoring, and automated coaching recommendations are explicitly outside Arc 13 scope
   with documented rationale for each.

5. **A safe first intelligence slice is defined.** Five deterministic, count-based
   dashboard indicators derived from existing authorized data are recommended as the
   first runtime surface, each subject to a documented indicator rule card and the
   full blocking checklist.

### Recommended next step

Implement the Safe First Intelligence Slice as the first Arc 13 runtime phase, using
the blocking checklist as the implementation gate. Prioritize defining indicator rule
cards and confirming upstream authorization patterns before writing any component code.
