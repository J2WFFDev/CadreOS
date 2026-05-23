# Phase 6A — FieldOps Planning

## Purpose

Phase 6A defines FieldOps as a planning artifact only. It does not implement application code, routes, or schema changes.

## 1) FieldOps Definition

**FieldOps** is the facility/resource scheduling module for CadreOS.

It is intended to support:

- facilities
- fields/ranges/bays/resources
- booking requests
- conflict detection
- pre-checks
- recommendations
- final human approval

## 2) MVP FieldOps Scope

MVP FieldOps includes:

- Facility
- Resource
- Booking
- Booking status
- Basic calendar/list view
- Basic conflict detection
- Human approval flag/status

## 3) Future FieldOps Scope

Future versions may include:

- approval workflow expansion
- recurring bookings
- resource capacity rules
- required staff/roles
- safety officer requirement
- blackout dates
- weather/status notes
- notifications
- external calendar sync

## 4) Shooting Sports Examples

FieldOps must support practical shooting-sports usage such as:

- Range
- Bay
- Practice block
- Match block
- Safety officer requirement
- Steel target setup
- Shared equipment/resource reservation

## 5) Relationships to Existing Core MVP Data

FieldOps should relate to these existing Core MVP areas:

- **Organization**: top-level ownership and scope boundary
- **Program**: program-level booking context and permissions
- **Team**: team-level booking context
- **Event**: optional linkage between booking and scheduled event
- **Person**: requester/reviewer/approver attribution
- **Task**: follow-up actions from conflicts or failed pre-checks

## 6) Proposed Conceptual Data Model

This is a conceptual model for planning. It is not a Prisma schema change.

### Facility

- **Purpose**: Represents a physical location where bookable resources exist.
- **Key fields (MVP)**: id, organizationId, name, address summary, isActive.
- **Relationships**: belongs to Organization; has many FacilityResources.
- **Later fields**: contact details, operating hours, blackout policy defaults, weather policy metadata.

### FacilityResource

- **Purpose**: Represents a specific bookable unit at a facility (range, bay, field, room, etc.).
- **Key fields (MVP)**: id, facilityId, name, resourceType, isActive.
- **Relationships**: belongs to Facility; referenced by ResourceBookings and BookingRequests.
- **Later fields**: capacity limits, setup requirements, required roles/staff, equipment dependency rules.

### ResourceBooking

- **Purpose**: Represents the booking record for a resource timeslot.
- **Key fields (MVP)**: id, facilityResourceId, startAt, endAt, status, approvalRequired, approvedFlag/status.
- **Relationships**: belongs to FacilityResource; may link to Program, Team, Event, requester Person, approver Person; may have BookingConflicts.
- **Later fields**: recurrence references, weather outcome, attendance linkage summary, external sync ids.

### BookingRequest

- **Purpose**: Intake/request layer before a booking is approved/finalized.
- **Key fields (MVP)**: id, facilityResourceId, requestedByPersonId, requestedStartAt, requestedEndAt, status, notes.
- **Relationships**: belongs to FacilityResource and requester Person; may produce a ResourceBooking; may generate Task follow-ups.
- **Later fields**: recommendation metadata, reviewer routing, request revision history.

### BookingConflict

- **Purpose**: Stores detected conflict/pre-check findings related to a request or booking.
- **Key fields (MVP)**: id, bookingRequestId or resourceBookingId, conflictType, severity, message, isResolved.
- **Relationships**: linked to BookingRequest and/or ResourceBooking; may link to Task for remediation.
- **Later fields**: rule version, automated resolution hints, audit trail, suppression reason.

### BookingApproval

- **Purpose**: Represents explicit human approval/denial action for a booking workflow step.
- **Key fields (MVP)**: id, bookingRequestId, decision, decidedByPersonId, decidedAt, decisionNotes.
- **Relationships**: belongs to BookingRequest; references Person as approver; may update ResourceBooking status.
- **Later fields**: multi-step approvals, delegated approvals, escalation state, SLA timestamps.

## 7) Booking Lifecycle

Suggested lifecycle statuses:

1. **DRAFT**
2. **REQUESTED**
3. **PRECHECK_PASSED**
4. **CONFLICT_FOUND**
5. **RECOMMENDED**
6. **APPROVED**
7. **DENIED**
8. **CANCELED**
9. **COMPLETED**

## 8) Conflict Rules

FieldOps conflict/pre-check rules should include:

- same resource overlapping time window
- facility blackout window conflict
- overlap with related Event timing constraints
- missing required role/staff (for example, safety officer)
- resource unavailable/inactive/maintenance state
- capacity exceeded

## 9) UX Flows

MVP UX flows should include:

1. **Create booking request** with resource, time range, purpose, and program/team context.
2. **View resource calendar/list** to inspect existing reservations and open slots.
3. **See conflicts/pre-checks** before approval and capture recommendations.
4. **Approve/deny booking** through explicit human decision status.
5. **Link booking to Event** when a scheduled event needs a specific resource.
6. **Create follow-up Task from conflict** when manual remediation is needed.

## 10) Security and Authorization Assumptions

FieldOps should use the existing auth model assumptions:

- **Organization Admin** can manage all FieldOps records.
- **Program Director** can request/manage bookings for their program.
- **Coach** can request bookings for their team/program context.
- **Assistant Coach** may view or request based on future policy decisions.
- **Parent/Guardian** and **Athlete** do not manage FieldOps in MVP.

## 11) Implementation Phases

Recommended sequence:

- **Phase 6B**: FieldOps schema draft
- **Phase 6C**: Facility/resource read-only views
- **Phase 6D**: Booking request workflow
- **Phase 6E**: Conflict detection
- **Phase 6F**: Approval workflow

## 12) Open Decisions

Open product and implementation decisions:

1. Does every Event require a Booking?
2. Can a Booking exist without an Event?
3. Should approval be required for all bookings?
4. How should recurring practice reservations work?
5. Should resources include equipment, or should that remain in GearOps?

## Phase 6A Output Summary

- FieldOps definition and boundaries are documented.
- MVP and future scope are separated.
- Conceptual entities and lifecycle states are defined.
- Conflict rules, UX flows, and security assumptions are outlined.
- A phased implementation sequence and open decisions are established.
