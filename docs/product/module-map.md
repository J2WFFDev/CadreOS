# CadreOS Module Map

## Purpose
This module map defines the initial product documentation baseline for CadreOS. It aligns development, testing, and roadmap sequencing without introducing sales or launch messaging.

## Module Landscape

| Module | Primary Scope | Current Documentation State | Roadmap Dependency Notes |
|---|---|---|---|
| GearOps | Equipment inventory, custody, readiness, maintenance, event deployment | **Pilot module** with initial use cases, workflow, and test scenarios | Depends on mobile-web operator views and offline capture/sync foundations for field operations scale |
| CoachOps | Team operations, coaching workflows, planning and execution support | Not documented in this set beyond module mapping | Depends on role-appropriate workflow templates and event/attendance data interoperability |
| FieldOps | Field/facility operations, scheduling and event coordination | Not documented in this set beyond module mapping | Depends on shared event model and cross-module conflict visibility |
| ResourceOps | Shared organizational resources and allocation controls | Not documented in this set beyond module mapping | Depends on standardized inventory/resource lifecycle language from GearOps pilot |
| Mobile Web (Future Capability) | Browser-based operator workflows on phones/tablets | Roadmap item only | Depends on responsive workflow screens and role-aware action simplification |
| Mobile App (Future Capability) | Installable native-like operator experience | Roadmap item only | Depends on mobile web UX stabilization and sync conflict rules |
| Offline Capture + Sync (Future Capability) | Local action capture with deferred synchronization | Roadmap item only | Depends on append-only operational logs, conflict policy, and audit-safe reconciliation |

## Pilot Decision
GearOps is the first documentation pilot because it exercises:
- fast operator interactions (checkout/check-in)
- custody accountability transitions
- readiness and maintenance constraints
- event-driven issuance and return
- guardian approval edge handling

## Cross-Module Role Footprint
The following roles are in scope across CadreOS documentation and future module expansion:

- Program Owner
- Team Admin
- Head Coach
- Assistant Coach
- Parent/Guardian
- Athlete
- Equipment Manager
- Event Operator
- Volunteer

## Assumptions
- CadreOS remains operationally focused with traceable state transitions per module.
- GearOps documentation patterns become reusable templates for CoachOps, FieldOps, and ResourceOps.
- Future mobile/offline features are roadmap-scoped and not implementation-committed in this baseline.

## Open Questions
- Which module should follow GearOps as the second documentation pilot: CoachOps, FieldOps, or ResourceOps?
- What minimum shared terminology must be standardized before cross-module documentation expands?
- Which roles require reduced-complexity views for mobile web first?

## Roadmap Dependencies
- Finalize GearOps pilot artifacts first (use cases, workflow, test scenarios).
- Define cross-module lifecycle vocabulary using GearOps outcomes.
- Sequence mobile web operator patterns before mobile app packaging decisions.
- Establish offline capture and sync policies before any field-first rollout commitments.
