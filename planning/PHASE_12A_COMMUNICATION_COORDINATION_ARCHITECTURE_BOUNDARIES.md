# Phase 12A — Communication & Coordination Architecture Boundaries

## Goal

Define communication and coordination architecture boundaries before any runtime messaging, notifications, Feed, or Inbox behavior is implemented.

## Scope Guardrails (enforced)

- Do not implement messaging/chat runtime.
- Do not implement notifications/reminders runtime.
- Do not implement Feed or Inbox runtime behavior.
- Do not expose guardian-facing runtime communications.
- Do not implement workflow automation/escalation runtime behavior.
- Keep this phase architecture/review focused.
- Preserve organization scoping and authorization behavior.
- Do not introduce new major dependencies.

## Reviewed Runtime Baseline (Arcs 8–11)

### Operational workflows currently implemented

- Staff-authenticated, organization-scoped operations across dashboard, people/teams, events/attendance, notes, tasks, and FieldOps remain active.
- `ObservationNote` and `FollowUpTask` remain authoritative operational models.
- Arc 10 Entry runtime remains additive wrapper metadata only (`EntryRuntimeRef`) with read-only relationship inspection.

### Auth/scoping baseline relevant to communications

- Organization scope is resolved through `getOrganizationScope()` and used as the base boundary.
- Staff-gated authorization helpers remain the access foundation for operational content.
- Guardian relationship visibility remains staff-diagnostic only; relationship linkage is not communication permission.

## Communication Planning Concepts Reviewed

- Feed and Inbox concepts: planning-only, runtime deferred.
- Notifications/reminders: planning-only, runtime deferred.
- Announcements: planning concept only, no runtime channels.
- Guardian communication: explicitly deferred pending policy/consent boundaries.
- Operational alerts/reminders: currently human-driven review workflows, not automated delivery.

## Communication Categories (Architecture)

### 1) Operational coordination (staff-internal)

- Workflow continuity signals tied to current operations (roster/event/attendance/note/task/FieldOps review lanes).
- Should remain staff-scoped, organization-bound, and policy-evaluated.
- This is closest to existing runtime behavior and lowest-risk future communication foundation.

### 2) Informational summaries (read-model outputs)

- Dashboard summaries, readiness indicators, and history/review context.
- These are not direct user-to-user communications and should remain separate from messaging systems.
- Treat as derived operational reporting surfaces, not notification channels.

### 3) Announcements (future broadcast communication)

- Team/program/organization-wide coordination messages.
- Requires explicit audience derivation and visibility policies before runtime delivery.
- Must not reuse staff-only operational content by default.

### 4) Guardian-directed communications (future, policy-gated)

- Guardian-facing updates linked to athlete relationships.
- Requires relationship validity, consent/opt-out policy, and strong leakage prevention.
- Remains blocked in runtime for this phase.

## Operational vs Informational Messaging Boundary

- **Operational messaging** (future): action- or workflow-triggered staff coordination that may require acknowledgement or follow-up.
- **Informational messaging** (future): broadcast or FYI content without workflow ownership transfer.
- **Current implemented summaries** are informational read models only and must not be treated as messaging delivery.

## Internal Staff Communication Boundary

- Staff-facing communication should align with current staff-role and scope checks.
- Team/program scoping rules must be preserved for audience eligibility.
- Communication objects must not bypass existing authorization helper contracts.

## Guardian Communication Boundaries

- Guardian-facing communication runtime remains blocked.
- Staff-only notes/tasks context must never be exposed through communication summaries or delivery payloads.
- Relationship linkage alone must never imply guardian communication entitlement.

## Notification Categories (Future Taxonomy)

1. **Operational attention signals** (e.g., overdue unresolved task context).
2. **Schedule/event reminders** (e.g., event readiness/attendance windows).
3. **System status/admin notices** (e.g., scoped operational admin prompts).
4. **Announcement delivery notices** (future broadcast delivery acknowledgements).

Initial policy: categories exist as architecture taxonomy only; no runtime dispatch is introduced in 12A.

## Delivery Expectations (Architecture-Level)

- Start with in-app, staff-only, organization-scoped delivery semantics when runtime begins.
- Require explicit actor scope + recipient scope evaluation for every delivery attempt.
- Require predictable failure handling (retry policy, dead-letter handling strategy, and operator-visible delivery state) before broader channel rollout.
- Keep external channels (push/SMS/email-like expansion) out of first runtime slice.

## Audit and Traceability Concerns

- Delivery decisions must be auditable: who initiated, intended audience, policy outcome, and final delivery status.
- Authorization decision lineage should remain explainable and compatible with existing structured auth decision logging patterns.
- Communication records must separate source operational entity metadata from delivery events to reduce coupling and leakage risk.

## Boundary Definitions (Must Remain Separate)

1. **Entry vs messaging**
   - Entry wrapper metadata is operational traceability, not conversation runtime.
   - No chat/thread semantics should be added to Entry runtime surfaces.
2. **Feed vs notifications**
   - Feed is a read stream concept; notifications are delivery/attention mechanics.
   - Feed introduction must not imply delivery channel behavior.
3. **Inbox vs tasks**
   - Inbox is capture/triage concept; tasks are accountable execution records.
   - Inbox queues must not silently replace task ownership/status semantics.
4. **Operational summaries vs communications**
   - Dashboard/readiness/history summaries are derived operational visibility.
   - They are not direct communication payloads or notification dispatches.

## Communication Risk Areas

1. **Authorization leakage**
   - Incorrect recipient derivation can expose cross-scope or staff-only data.
2. **Guardian visibility mistakes**
   - Stale/incorrect relationship linkage can route sensitive data to wrong guardians.
3. **Notification fatigue**
   - High-volume low-signal delivery can reduce operator responsiveness.
4. **Escalation complexity**
   - Automated escalation logic can create policy conflicts before consent and priority rules are mature.
5. **Delivery reliability**
   - Without explicit failure/retry and operator visibility, communication workflows become non-deterministic.

## Do Not Implement Yet

- Real-time chat.
- Push notifications.
- SMS delivery.
- Guardian-facing messaging.
- Automated escalation workflows.

## Safe First Communication Slice (Recommendation)

**Recommendation:** Start with a strictly internal, in-app, staff-only communication event log tied to existing operational entities, exposed as read-only status indicators on existing staff surfaces.

Why this is safest:

- Preserves current organization-scoped authorization posture.
- Avoids guardian delivery and consent complexity in first slice.
- Keeps communications additive and reversible without replacing note/task/event authority.
- Builds audit/delivery-state primitives before introducing real notification channels.

## Blocking Before Runtime Messaging Checklist

- [ ] Finalize communication policy contract (categories, audience rules, allowed source entities).
- [ ] Formalize guardian communication policy (relationship validation, consent, opt-out, stale-link handling).
- [ ] Define authorization evaluation path for sender + recipient + organization/team/program scope.
- [ ] Define audit schema for communication decision and delivery lifecycle traceability.
- [ ] Define delivery failure semantics (retry, abandonment, operator-visible state).
- [ ] Define anti-fatigue controls (rate limits, digest policy, suppression windows).
- [ ] Validate no staff-only operational context can leak into guardian/shared payloads.
- [ ] Complete cross-role/cross-scope communication access test matrix.
- [ ] Confirm Feed and Inbox runtime dependencies remain blocked until communication policy gates are complete.
- [ ] Confirm workflow automation/escalation remains deferred until manual delivery reliability is proven.

## Validation and Compliance Confirmation

- Architecture review reflects implemented Arc 8–11 runtime/auth behavior and deferred boundaries.
- No runtime communication features were added in this phase.
- No Feed/Inbox runtime behavior was added in this phase.
- No messaging/notification runtime behavior was added in this phase.
- Runtime code was not touched; additional typecheck/build for this phase output was not required.

## Source References

- `planning/PHASE_8P_OPERATIONAL_FOUNDATION_MVP_CLOSEOUT.md`
- `planning/PHASE_9M_MINIMAL_RUNTIME_ENTRY_SLICE_DESIGN.md`
- `planning/PHASE_9N_ENTRY_RUNTIME_READINESS_GATE_REVIEW.md`
- `planning/PHASE_10D_ENTRY_RELATIONSHIP_VIEW.md`
- `planning/PHASE_10E_ENTRY_RUNTIME_STABILIZATION_CLOSEOUT.md`
- `planning/PHASE_11A_PILOT_VALIDATION_PLAN.md`
- `planning/PHASE_11B_OPERATIONAL_WORKFLOW_FRICTION_STABILITY_REMEDIATION.md`
- `planning/PHASE_11C_PILOT_STABILITY_CLOSEOUT_OPERATIONAL_READINESS_REVIEW.md`
- `planning/PHASE_6B_ENTRY_INBOX_FEED_JOURNAL_PLAN.md`
- `planning/ROADMAP.md`
- `planning/PHASE_8A_GUARDIAN_WORKFLOW_FOUNDATION.md`
- `planning/PHASE_9D_ENTRY_VISIBILITY_ACCESS_POLICY.md`
- `lib/organization-context.ts`
- `lib/authorization/index.ts`
- `lib/guardian-relationship-access.ts`
- `lib/entry-runtime.ts`
- `app/(dashboard)/entry-runtime/[entryRuntimeRefId]/page.tsx`

## PR Summary

Phase 12A defines CadreOS communication and coordination architecture boundaries before runtime delivery work. The review confirms current implementation remains staff-scoped operational workflows with additive/read-only Entry wrapper metadata, and no Feed/Inbox/messaging/notification/guardian-facing communication runtime behavior. This phase establishes category definitions, boundary separation rules, communication risk areas, explicit deferred scope, a safe-first internal communication slice recommendation, and a blocking checklist that must be satisfied before runtime messaging begins.
