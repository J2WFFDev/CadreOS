# Status Language

This document defines the shared status vocabulary for CadreOS. Consistent status language reduces cognitive load for operators working across multiple modules.

---

## Purpose

CadreOS surfaces status across many modules: events, attendance, gear items, assignments, tasks, notes, readiness checks, bookings, and more. Using inconsistent status labels forces users to re-learn terminology per module and introduces ambiguity in audit trails.

This vocabulary defines canonical status values. Modules should use these values wherever they apply. Module-specific extensions must document their relationship to this shared vocabulary.

---

## Canonical Status Vocabulary

### Ready

**Meaning:** The entity is in a valid, complete, and actionable state. All required conditions are met.

**Usage contexts:**
- Gear item: inspected, assigned, available for use
- Athlete roster entry: guardian approvals complete, participation confirmed
- Event: setup complete, roster confirmed, resources booked
- Booking: confirmed, resources allocated

**Visual treatment:** Green indicator; positive/affirming language

---

### Pending

**Meaning:** The entity is awaiting a required action, approval, or input before it can progress. It is not blocked — action is expected and in process.

**Usage contexts:**
- Attendance record: submitted but not yet confirmed
- Guardian approval: requested but not yet received
- Booking: submitted but not yet confirmed
- Sync operation: captured locally, not yet synced to server

**Visual treatment:** Yellow/amber indicator; neutral/waiting language

---

### Blocked

**Meaning:** The entity cannot proceed because a hard dependency is unmet. Explicit action is required to unblock it.

**Usage contexts:**
- Event readiness: missing required gear, missing guardian approval, unresolved conflict
- Gear checkout: item under maintenance hold, custody conflict, permission denied
- Task: blocked by unresolved dependency

**Visual treatment:** Red or orange indicator; urgent/attention language

---

### Needs Review

**Meaning:** The entity requires human review before proceeding. Automated validation may have flagged it, or a workflow step requires a decision.

**Usage contexts:**
- Maintenance intake: condition flags require staff review
- Conflict resolution: sync conflict requires manual decision
- Guardian note: staff review required before action
- Booking conflict: precheck flagged an issue

**Visual treatment:** Orange or purple indicator; attention language

---

### Checked Out

**Meaning:** A physical asset or resource has been issued to a custodian and is currently in their possession.

**Usage contexts:**
- Gear item: currently issued to an athlete or staff member
- Equipment: in active use at a location

**Visual treatment:** Blue indicator; neutral operational language

---

### Returned

**Meaning:** A previously checked-out asset has been returned and received.

**Usage contexts:**
- Gear item: returned after checkout, awaiting inspection or storage
- Equipment: received back at facility

**Visual treatment:** Gray or neutral indicator; closed/resolved language

---

### Overdue

**Meaning:** An expected action, return, or completion has not occurred by its due date or time.

**Usage contexts:**
- Gear return: not returned by expected return date
- Task: past due date without completion
- Guardian approval: requested but not received within expected window

**Visual treatment:** Red indicator; urgent attention language

---

### Incomplete

**Meaning:** A multi-step process or checklist has been started but not all required steps are done.

**Usage contexts:**
- Event setup checklist: some items complete, some remaining
- Readiness verification: some checks passed, others not yet addressed
- Maintenance intake: form started but not submitted

**Visual treatment:** Yellow/amber indicator; in-progress language

---

### Complete

**Meaning:** All required steps in a workflow or checklist are done. The entity has reached a terminal successful state for its current lifecycle stage.

**Usage contexts:**
- Event setup checklist: all items done
- Task: marked done
- Maintenance intake: submitted and processed
- Attendance: marked for all expected attendees

**Visual treatment:** Green indicator; affirming language

---

### Archived

**Meaning:** The entity is no longer active. It is preserved for audit and historical reference but is not visible in default operational views.

**Usage contexts:**
- Gear item: retired from active use
- Event: past and closed
- Person record: inactive/departed
- Season: concluded

**Visual treatment:** Gray, muted; historical/inactive language

---

## Status Application by Module

| Module | Applicable Statuses |
|---|---|
| Gear Items | Ready, Checked Out, Returned, Overdue, Needs Review, Blocked, Archived |
| Gear Checkout | Pending, Checked Out, Returned, Overdue |
| Gear Maintenance | Pending, Needs Review, Incomplete, Complete |
| Attendance | Pending, Complete, Incomplete |
| Events | Pending, Incomplete, Ready, Complete, Archived, Blocked |
| Readiness Checks | Ready, Needs Review, Blocked, Incomplete, Complete |
| Tasks | Pending, Blocked, Needs Review, Complete, Overdue |
| Guardian Approval | Pending, Complete, Blocked, Overdue |
| Bookings | Pending, Ready, Blocked, Needs Review, Archived |
| Roster Entries | Pending, Ready, Blocked, Archived |
| Sync Operations | Pending, Complete, Needs Review (conflict) |

---

## Status Extension Rules

Modules may define additional status values where the canonical vocabulary is genuinely insufficient. When doing so:

1. Document the extension in the relevant module planning doc.
2. Map the extension to its closest canonical equivalent for cross-module use.
3. Do not use a module-specific status value in shared components (e.g., StatusBadge) without a canonical fallback.

**Example:**
- GearOps might define `Under Maintenance` as a module-specific status.
- Its canonical mapping is `Blocked` (the item cannot be checked out or assigned).
- A generic StatusBadge can render `Blocked` while GearOps detail views render `Under Maintenance`.

---

## StatusBadge Component

See `component-patterns.md` for the `StatusBadge` component definition, which implements this vocabulary visually.

---

## Anti-Patterns

- Do not use "Active" and "Inactive" as status values. They are lifecycle states, not workflow statuses. Use `Archived` for retired entities.
- Do not use "Yes" / "No" as status values. Use the vocabulary above.
- Do not use module-internal jargon (e.g., "CustodyTransferred") as a status badge value visible to end users. Map it to the canonical vocabulary.
- Do not use colors alone to communicate status without a label. Always pair color with text.
