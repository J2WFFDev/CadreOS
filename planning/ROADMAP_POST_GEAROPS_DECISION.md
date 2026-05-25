# CadreOS Post-GearOps Roadmap Decision (Arc 16I Handoff)

## Purpose

Select the next CadreOS build arc after GearOps MVP closeout by comparing three options against:

- operational value
- user pain addressed
- dependency readiness
- implementation risk
- authorization/privacy risk
- data model maturity
- likely MVP phase sequence
- deferred scope boundaries

This is a planning-only decision artifact. It does not add runtime scope or schema scope.

---

## Current Product Maturity Snapshot

### Core MVP (implemented and in active use)
- Organization/program/team/person model with role-aware scoping.
- Team roster operations, events/attendance, notes/tasks, dashboard workflows.
- Clerk-based identity and organization-scoped authorization patterns.

### FieldOps MVP (implemented and closed out)
- Facility/resource catalog, booking request flow, precheck/conflict persistence, approval workflow, and operational dashboard visibility.
- Expansion scope remains intentionally deferred.

### GearOps MVP (implemented and closed out)
- Category/item lifecycle, assignment, checkout/check-in, maintenance logs, consumable transactions, and module dashboard/list/detail surfaces.
- Deferred GearOps add-ons (barcode, purchasing/finance, automation, parent-facing agreements, mobile-native inventory) remain deferred.

### Strategic context
- Communications runtime (Track 3 delivery channels) remains deferred.
- Entry/runtime privacy boundaries and consent/opt-out infrastructure are not yet mature enough for delivery-channel rollout.

---

## Next-Arc Options Comparison

| Option | Operational value | User pain addressed | Dependency readiness | Implementation risk | Authorization/privacy risk | Data model maturity | Likely MVP phases | Defer now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Roster / Member Lifecycle** | High daily value for coaches/admins; strengthens the people foundation used by all modules. | Team accuracy drift, role ambiguity, season rollover friction, manual cleanup burden. | **High** (builds on Team, Person, RosterMembership, RoleAssignment, Season, guardian context). | Medium (workflow/state consistency and UX continuity). | Medium (staff/guardian visibility boundaries must remain strict). | **High** (core entities already active). | 4–6 focused phases. | Advanced cross-org roster automation, parent self-service, bulk import migration tooling. |
| **B. Ops Reporting & Operational Review** | Medium-High value; improves weekly management visibility across events/tasks/attendance/FieldOps/GearOps. | Fragmented review cadence, delayed issue detection, limited trend context. | Medium (data exists, but depends on cleaner roster/member lifecycle baselines for reliable signals). | Medium | Medium (role-scoped summary visibility and sensitive context rollups). | Medium (enough for summary reporting, not full analytics). | 3–5 phases. | Predictive analytics, BI exports, automated recommendation engines. |
| **C. Track 3 Communications Toolset** | Medium strategic value, lower immediate safety for current maturity. | Slow follow-up loops, manual outreach gaps, no delivery channels. | **Low-Medium** (blocked by tighter access boundaries, consent policy, and notification governance). | High | **High** (delivery mistakes, audience leakage, guardian/privacy boundary violations). | Low-Medium (operational data exists, but communication-specific policy/consent models are incomplete). | 5–8 phases plus policy hardening. | External channels, DM/group messaging, parent broadcast workflows, automation-triggered delivery. |

---

## Option Details

## Option A — Roster / Member Lifecycle

### Operational value
Improves the highest-frequency operational workflow: maintaining correct team membership, role ownership, and season continuity.

### User pain addressed
- “Who is on this team now?” ambiguity.
- Inconsistent roster state across season transitions.
- Manual correction overhead for role and membership drift.

### Dependency readiness
Strong. Core data and authorization surfaces are already implemented and battle-tested in MVP use paths.

### Implementation risk
Moderate. Main risks are state-transition clarity and preventing lifecycle regressions across existing team/event/task workflows.

### Authorization/privacy risk
Moderate. Requires continued staff-gated guardian-context behavior and strict org/program/team scope handling.

### Data model maturity
High. Existing model set supports incremental lifecycle hardening without opening communication runtime scope.

### Likely MVP phases
- Roster Arc A1: Lifecycle state definitions and acceptance criteria lock.
- Roster Arc A2: Join/move/inactive/reinstate workflow hardening.
- Roster Arc A3: Season rollover and continuity safeguards.
- Roster Arc A4: Role-assignment alignment and mismatch remediation UX.
- Roster Arc A5: Validation closeout and deferred-scope confirmation.

### Remain deferred
- Parent/guardian communication runtime actions.
- Self-service guardian onboarding and approval workflows.
- Bulk migration/import engines and automation-driven roster updates.

---

## Option B — Ops Reporting and Operational Review

### Operational value
Improves weekly management visibility and helps staff review unresolved work earlier.

### User pain addressed
- Hard-to-assemble cross-module review context.
- Late detection of attendance/task/operational gaps.

### Dependency readiness
Moderate. Data exists, but reporting quality improves significantly after roster/member lifecycle consistency is tightened.

### Implementation risk
Moderate. Risk centers on metric semantics, query performance, and maintaining role-safe filtering across modules.

### Authorization/privacy risk
Moderate. Rollups can accidentally reveal sensitive context if scope filters or staff-only boundaries are inconsistent.

### Data model maturity
Moderate. Sufficient for operational summaries; not yet suited for advanced analytics commitments.

### Likely MVP phases
- Reporting Arc B1: Metric definitions + operational review lane criteria.
- Reporting Arc B2: Staff-scoped summary dashboards and drilldowns.
- Reporting Arc B3: Weekly review cadence views and stale-state signals.
- Reporting Arc B4: Validation closeout and quality calibration.

### Remain deferred
- Predictive analytics and recommendation scoring.
- External BI sync/export pipelines.
- Automated escalations and workflow automation.

---

## Option C — Track 3 Communications Toolset

### Operational value
Potentially high long-term, but lower immediate value than strengthening people foundation and review quality first.

### User pain addressed
- Manual coordination and reminders.
- Missing delivery-channel confirmation loops.

### Dependency readiness
Low-Medium. Requires more mature authorization/visibility boundaries, consent/opt-out policy design, and communication governance.

### Implementation risk
High. Delivery reliability, retries/failures, preference management, and channel complexity can quickly expand scope.

### Authorization/privacy risk
High. Wrong-audience delivery and guardian/staff boundary mistakes are critical trust failures.

### Data model maturity
Low-Medium for communication runtime. Existing operational data is not enough on its own to safely launch delivery-channel behavior.

### Likely MVP phases
- Comms Arc C1: Policy + consent + audience boundary architecture lock.
- Comms Arc C2: Internal-only notification event model foundation.
- Comms Arc C3: In-app delivery inbox/surface with strict staff scoping.
- Comms Arc C4+: Preference management, auditability, and gradual channel expansion.

### Remain deferred
- External messaging channels (SMS/email/push).
- Parent broadcast and guardian communication automations.
- DM/group messaging runtime.

---

## Recommendation

**Recommended next arc: Option A — Roster / Member Lifecycle.**

### Why this is next
1. Highest immediate operational value with lowest strategic risk among the three options.
2. Strongest dependency readiness: extends proven Core MVP entities already used daily.
3. Improves data quality and operational consistency needed before meaningful reporting uplift.
4. Reduces downstream privacy risk by hardening people/scope boundaries before communications delivery channels.

---

## Proposed Phase Sequence (Recommended Arc)

1. **Phase R1 — Lifecycle Definition and Guardrails**
   - Lock member lifecycle states, transition rules, and acceptance criteria.
2. **Phase R2 — Join/Move/Inactive/Reinstate Workflow Hardening**
   - Stabilize core roster transitions with clear validation and scope checks.
3. **Phase R3 — Season Rollover and Continuity**
   - Add safe rollover behavior and mismatch detection across roster + role assignments.
4. **Phase R4 — Operational Review Readiness for Roster Quality**
   - Add lightweight roster-quality indicators that support subsequent reporting arc readiness.
5. **Phase R5 — Arc Closeout and Next-Arc Decision Handoff**
   - Validate outcomes, confirm deferred scope, and hand off to Ops Reporting (Option B) decision gate.

---

## Not Now (Deferred Options)

- **Not now: Option B (Ops Reporting)** — defer until Roster Arc closeout establishes stronger lifecycle consistency and cleaner review signals.
- **Not now: Option C (Track 3 Communications)** — defer until access boundaries, consent policy, and communication governance are demonstrably mature enough for delivery-channel safety.

---

## Decision Summary

After Arc 16I GearOps closeout, CadreOS should proceed with **Roster / Member Lifecycle** as the next build arc, then sequence into **Ops Reporting** after roster-quality foundations are stabilized, while keeping **Track 3 Communications** deferred until privacy, authorization, and consent boundaries are mature.

---

## Source References

- `planning/ROADMAP_POST_15A_GEAROPS_NEXT.md`
- `planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`
- `planning/README.md`
- `planning/MODULE_ROADMAP_FIELDOPS_GEAROPS.md`
- `planning/ROADMAP.md`
- `planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md`
- `planning/PHASE_6K_FIELDOPS_MVP_CLOSEOUT.md`
- `planning/PHASE_15A_USER_TEST_CASE_SUITE.md`
