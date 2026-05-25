# Phase 18A — Ops Reporting and Operational Review Architecture Boundaries

## Goal

Establish the Arc 18A planning foundation for Ops Reporting and Operational Review before any reporting runtime surfaces are added.

This phase is architecture/scope definition only: no Prisma schema updates, no runtime feature delivery, and no expansion into deferred reporting-adjacent domains.

## Scope Guardrails (enforced)

- Do not change runtime code.
- Do not change Prisma schema.
- Do not add reporting pages yet.
- Do not add messaging or notifications.
- Do not add AI recommendations or automation.
- Do not add export implementations yet.
- Do not add external integrations, external APIs, or scheduled reporting delivery.
- Do not modify Core MVP, FieldOps MVP, GearOps MVP, or Arc 17 roster lifecycle workflows.

---

## Arc 18 Purpose

Arc 18 provides reporting architecture that improves operational visibility across existing CadreOS domains without changing current workflow ownership or behavior.

Arc 18 must:

1. Provide operational visibility across existing CadreOS domains.
2. Support weekly review, readiness review, and operational management.
3. Improve visibility without introducing workflow automation.
4. Preserve existing Core MVP, FieldOps MVP, GearOps MVP, and Arc 17 lifecycle behavior.

---

## In-Scope Reporting Areas

### 1) People / Team / Program Operational Summaries
- Staff-facing rollups for person/team/program operational context.
- Summary-level readiness and unresolved-work visibility by existing scope.

### 2) Lifecycle Status Summaries
- Staff-facing summaries of member lifecycle status distribution and transitions.
- Read-only operational visibility aligned to Arc 17 lifecycle semantics.

### 3) Roster Readiness Summaries
- Team/program roster readiness rollups (coverage, assignment gaps, unresolved readiness concerns).
- Seasonal operational readiness visibility using existing data and routes.

### 4) Attendance / Event Reporting
- Event participation and attendance-capture reporting summaries.
- Attendance review lanes for weekly operational cadence.

### 5) Notes / Follow-up Task Summaries
- Cross-surface summaries for note activity, follow-up workload, and unresolved items.
- Staff operational review visibility for stale and urgent follow-up context.

### 6) FieldOps Resource Utilization and Booking Summaries
- Facilities/resources/bookings summary reporting and approval/conflict visibility.
- Read-only operational review lanes based on existing FieldOps data.

### 7) GearOps Inventory and Accountability Summaries
- Inventory/assignment/checkout/maintenance/consumable summary reporting.
- Read-only accountability and condition/risk visibility from existing GearOps workflows.

### 8) Guardian Relationship Readiness Summaries
- Staff-only guardian linkage readiness summaries in operational context.
- Guardian relationship gap/coverage visibility consistent with existing staff-gated patterns.

### 9) Dashboard / Report Navigation Integration
- Navigation and dashboard integration for report entry points and review lanes.
- Context-preserving links into existing operational surfaces.

### 10) Export-Friendly Read Views (Where Practical)
- Read-model and presentation planning for future export-friendly reporting views.
- No export runtime implementation in Arc 18A.

---

## Out-of-Scope Boundaries

The following areas are explicitly excluded from Arc 18A and Arc 18 reporting scope unless later explicitly approved:

| Area | Status |
|------|--------|
| Messaging / notifications | 🔲 Deferred |
| Parent-facing or guardian-facing reporting surfaces | 🔲 Deferred |
| AI recommendations or intelligent scoring | 🔲 Deferred |
| Workflow automation / escalation behavior | 🔲 Deferred |
| Financial reporting | 🔲 Deferred |
| External BI integrations | 🔲 Deferred |
| External APIs for reporting data | 🔲 Deferred |
| Scheduled report delivery | 🔲 Deferred |
| Workflow mutations triggered from reports | 🔲 Deferred |

---

## Arc 18 Phase Sequence

| Phase | Description |
|------|-------------|
| **18A** | Reporting architecture and boundaries (this document) |
| **18B** | Core operational summary reports |
| **18C** | Attendance and event reporting |
| **18D** | Notes/task operational review reporting |
| **18E** | FieldOps reporting |
| **18F** | GearOps reporting |
| **18G** | Roster lifecycle and guardian readiness reporting |
| **18H** | Export-friendly reporting views |
| **18I** | Reporting dashboard integration and closeout |

---

## Authorization and Privacy Expectations

### Organization-scoped reporting
- All reporting reads remain organization-scoped via existing organization-context patterns.
- No cross-organization aggregation or cross-organization report visibility.

### Staff-only reporting access
- Reporting surfaces are staff-facing only.
- No `ATHLETE` or `PARENT_GUARDIAN` reporting access.

### No guardian/parent reporting visibility
- Guardian/parent user visibility for reporting remains deferred.
- Guardian relationship reporting remains staff diagnostics context only.

### Preserve existing role/scope patterns
- Reporting access must preserve current role/scope evaluation patterns.
- No parallel authorization model for reporting may be introduced.

### Preserve private staff-note boundaries
- `ObservationNote` staff-only visibility boundaries remain authoritative in reporting.
- Reporting summaries must not expose private staff note content beyond current authorization boundaries.

---

## Existing Surface and Model Alignment

Arc 18A reporting architecture is grounded in existing implemented surfaces and data:

- Dashboard operational review and navigation surfaces.
- People, teams, programs, roster/lifecycle readiness surfaces.
- Events and attendance capture/review surfaces.
- Notes and follow-up task operational context surfaces.
- FieldOps summary and booking review surfaces.
- GearOps summary and inventory accountability surfaces.
- Guardian relationship readiness diagnostics and staff-only visibility patterns.
- Existing organization-scoped relational model in `prisma/schema.prisma` across Core, FieldOps, GearOps, and lifecycle entities.

Arc 18A introduces no model ownership shifts and no workflow mutations in these domains.

---

## Validation and Compliance Confirmation

- This phase is documentation-only.
- Runtime code was not changed.
- Prisma schema was not changed.
- Reporting runtime surfaces are intentionally deferred to Arc 18B+.

---

## Source References

- `planning/README.md`
- `planning/ROADMAP.md`
- `planning/ROADMAP_POST_GEAROPS_DECISION.md`
- `planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`
- `planning/PHASE_17I_ROSTER_MEMBER_LIFECYCLE_CLOSEOUT.md`
- `planning/PHASE_15A_USER_TEST_CASE_SUITE.md`
- `prisma/schema.prisma`
- `components/nav-sidebar.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/people/page.tsx`
- `app/(dashboard)/teams/page.tsx`
- `app/(dashboard)/programs/page.tsx`
- `app/(dashboard)/events/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/notes/page.tsx`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/field-ops/page.tsx`
- `app/(dashboard)/field-ops/bookings/page.tsx`
- `app/(dashboard)/gear-ops/page.tsx`
- `app/(dashboard)/gear-ops/items/page.tsx`

---

## Phase 18A Output Summary

Phase 18A defines Arc 18 purpose, confirms in-scope reporting areas across people/lifecycle/roster/attendance/notes/tasks/FieldOps/GearOps/guardian readiness, establishes explicit out-of-scope boundaries (messaging, parent-facing reporting, AI/automation, financials, external integrations/APIs, scheduled delivery, workflow mutation), proposes the Arc 18 phase sequence (18A–18I), and locks organization-scoped staff-only authorization/privacy expectations before any reporting runtime implementation begins.
