# CadreOS Roadmap: Core MVP, FieldOps, and GearOps

## 1) CadreOS Core MVP Definition

CadreOS Core MVP is the minimum product surface needed to run one program end-to-end with role-aware operations and accountable follow-through.

Core MVP includes:
- People
- Programs
- Seasons
- Teams
- Rosters
- Roles
- Events
- RSVP
- Attendance
- Notes
- Follow-up Tasks
- Dashboard
- Navigation
- Clerk auth/access completion in progress (identity, route protection, authorization hardening)

Core MVP outcome:
- Staff can organize program structure, run events, track participation, capture observations, and drive follow-up in one system with auditable user identity.

## 2) FieldOps Module Definition

FieldOps is a future module for physical space operations and scheduling.

FieldOps scope:
- Facilities/fields/ranges/resources catalog
- Bookable time slots
- Conflict detection and anti-double-booking rules
- Booking requests/approvals (if needed by org policy)
- Event-to-resource linkage for confirmed location operations

FieldOps non-scope:
- People/roles/rosters ownership
- Core event lifecycle ownership
- Inventory/equipment lifecycle

## 3) GearOps Module Definition

GearOps is a future module for equipment and consumables lifecycle management.

GearOps scope:
- Inventory catalog (durable equipment and consumables)
- Assignment to people/teams/events
- Check-out/check-in accountability
- Stock and consumption tracking
- Maintenance/condition history

GearOps non-scope:
- Facility booking and space conflict resolution
- Core people/role/auth ownership

## 4) Core MVP vs Module Scope Boundaries

Belongs in Core MVP:
- Program operating records required in every deployment: people, roles, team structures, event flow, attendance, notes/tasks, dashboarding, and access control.
- Cross-cutting identity and authorization foundation.

Belongs in FieldOps/GearOps modules:
- Specialized operational domains not required for all pilots.
- Structured physical resource scheduling (FieldOps).
- Structured asset lifecycle and accountability (GearOps).

Boundary rule:
- If the program cannot safely operate baseline workflows without it, it is Core MVP.
- If it adds optional operational depth for certain organizations, it is module scope.

## 5) Recommended Build Order

1. **Complete Core MVP auth/access**
   - Finish real identity mapping, remove fallback actor assumptions, enforce deny-by-default authorization for write paths.
2. **Refine Notes / Inbox / Entry model**
   - Establish unified capture and triage semantics before adding new module domains.
3. **Build FieldOps**
   - Add structured facility/resource scheduling after core capture and access controls are stable.
4. **Build GearOps**
   - Add inventory and lifecycle management after the module extension pattern is proven with FieldOps.

## 6) Dependencies Between Modules

Core MVP auth/access dependencies:
- FieldOps and GearOps both depend on verified actor identity, org scoping, and role-aware authorization.

Notes/Inbox dependency:
- FieldOps and GearOps should leverage consistent capture/triage patterns from refined Notes/Inbox/Entry behavior for operational follow-up.

FieldOps dependencies:
- Depends on stable Core Event model for event-resource linkage.
- Depends on authorization for booking approval and conflict-rule administration.

GearOps dependencies:
- Depends on People/Teams/Events in Core for assignment targets.
- Depends on authorization for custody and maintenance actions.

Cross-module integration dependencies:
- FieldOps bookings can link to Events.
- GearOps assignments/checkouts can link to People/Teams/Events and optionally create follow-up tasks.

## 7) What Must Wait Until Auth and Authorization Are Complete

Do not build these before auth/access completion:
- Booking approvals and reviewer workflows (FieldOps)
- Conflict-rule enforcement with authoritative write blocking (FieldOps)
- Equipment custody chains (check-out/check-in) tied to accountable actors (GearOps)
- Equipment assignment authority and reassignment workflows (GearOps)
- Maintenance sign-off or compliance-style lifecycle attestations (GearOps)
- Any cross-module automation that triggers ownership-changing writes

Reason:
- Without verified identity and enforced authorization, these workflows create non-auditable records and unsafe permission exposure.
