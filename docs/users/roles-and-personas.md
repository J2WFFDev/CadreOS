# CadreOS Roles and Personas

## Purpose
This document defines operational personas for product development, testing, and workflow design. It does not define marketing segments.

## Persona Matrix

| Role | Core Objectives | Typical CadreOS Actions | Primary Modules |
|---|---|---|---|
| Program Owner | Maintain organizational compliance, readiness, and accountability | Review operational risk, approve policy rules, audit exceptions | GearOps, CoachOps, FieldOps, ResourceOps |
| Team Admin | Coordinate team-level execution and records | Manage rosters, coordinate assignments, verify readiness status | CoachOps, GearOps |
| Head Coach | Ensure athlete/team readiness and execution quality | Request/confirm gear availability, track event requirements | CoachOps, GearOps |
| Assistant Coach | Execute day-to-day support tasks | Perform check-in/out support, report missing or damaged gear | CoachOps, GearOps |
| Parent/Guardian | Approve applicable athlete-related actions | Provide guardian approval where required, review assigned items | GearOps (approval paths), CoachOps |
| Athlete | Receive and return assigned gear, participate in events | Accept custody, return items, confirm condition at handoff | GearOps, CoachOps |
| Equipment Manager | Operate inventory lifecycle and custody controls | Rapid checkout/check-in, custody transfer, maintenance intake, vault returns | GearOps |
| Event Operator | Stage and recover event equipment and support materials | Event gear checkout, readiness verification, post-event return checks | GearOps, FieldOps |
| Volunteer | Support approved operational tasks within constraints | Limited checkout/check-in actions with supervision and audit trail | GearOps, FieldOps |

## Role Constraints and Considerations

| Role Group | Constraint Focus | Documentation Impact |
|---|---|---|
| Administrative (Program Owner, Team Admin) | High visibility, exception handling, policy controls | Include full state context and override/audit notes |
| Operational Staff (Head Coach, Assistant Coach, Equipment Manager, Event Operator) | Speed + correctness under time pressure | Prioritize workflow clarity and exception branching |
| Community Roles (Parent/Guardian, Athlete, Volunteer) | Limited permissions, explicit approvals, guided interactions | Require narrower action sets and guardrails |

## Assumptions
- Role permissions differ by organization policy, but role responsibilities remain stable enough for shared documentation.
- Equipment Manager and Event Operator workflows are central for GearOps pilot validation.
- Parent/Guardian interactions are approval-focused, not broad administrative operations.

## Open Questions
- Which roles will receive direct mobile web workflows first?
- What approval latency is acceptable for guardian-gated actions during event preparation?
- Should Volunteer permissions be role-static or event-context-specific?

## Roadmap Dependencies
- Role definitions must map to authorization policy artifacts as they mature.
- Mobile app and offline capture plans must include role-specific risk controls.
- Cross-module UX standards should preserve role clarity while reducing navigation overhead.
