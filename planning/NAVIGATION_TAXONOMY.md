# CadreOS Navigation Taxonomy

> **Document type:** UI taxonomy reference  
> **Purpose:** Record the agreed primary sidebar structure without changing runtime business logic or schema.

## Agreed naming decisions

- **Home** remains the top operating area.
- The roster/member domain is **MemberOps**.
- **PeopleOps** and **TeamOps** are not the primary sidebar taxonomy names for the roster/member area.
- **Programs** and **Seasons** belong under **MemberOps**.
- **Seasons** remain nested inside Program workflows and should not become a separate top-level sidebar destination.
- Athlete, guardian, coach, and staff concepts remain roles or relationships inside People and MemberOps workflows, not standalone primary sidebar modules.

## Agreed primary sidebar taxonomy

### Home

- Home
- Feed
- Assigned to Me
- Today
- Upcoming
- Events
- Notifications

### MemberOps

- People
- Programs
- Teams
- Membership Lifecycle *(planned as a dedicated navigation surface once a dedicated route exists; currently surfaced within People filters and readiness views)*

## EntryOps taxonomy

EntryOps should move away from type-first navigation such as Notes, Tasks, Decisions, and Journals as primary sidebar categories.

Primary EntryOps surfaces are:

- Entries
- Inbox
- Labels / Views
- Entry Reports

Current route-backed sidebar links:

- Entries
- Inbox

Deferred until dedicated route support exists:

- Program view
- Team view
- Personal view
- Habits view
- Entry Reports

Feed remains reachable from **Home**, not EntryOps.

## FieldOps / ResourceOps note

The current coded `/field-ops` route family still contains facilities, resources, and bookings that match **ResourceOps** infrastructure rather than true FieldOps execution workflows.

For now:

- Keep existing `/field-ops` URLs intact.
- Group those routes clearly as **FieldOps / ResourceOps** in sidebar taxonomy.

Future refactor note:

- Split ResourceOps infrastructure routes from true FieldOps execution routes in a later phase.
- Expected direction is a dedicated `/resource-ops` route family, leaving `/field-ops` for live operational execution concerns.

## GearOps taxonomy

GearOps remains its own primary module and should continue to expose reporting access in navigation.

## AdminOps taxonomy

AdminOps should own:

- Roles & Permissions
- Settings
- Prompts / Templates
- Global Reports
- Audit / History

Current route-backed sidebar links:

- Prompts / Templates
- Global Reports

Deferred until dedicated route support exists:

- Roles & Permissions
- Settings
- Audit / History

## Account / Profile placement

The primary sidebar may omit Account/Profile only when the header-level account control remains accessible.

Current state:

- Header account link and Clerk user control remain available.
- Sidebar Account/Profile link can stay removed from primary navigation.
