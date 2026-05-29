# CadreOS Sidebar Taxonomy v1

This document defines the approved CadreOS sidebar taxonomy. The canonical implementation lives in `/tmp/workspace/J2WFFDev/CadreOS/lib/navigation/cadreos-nav.ts`.

## Guardrails

- The canonical nav config controls sidebar labels, groups, order, and paths.
- Auth, role, and dev persona work may filter visibility, but must not rename, reorder, regroup, or remove sidebar items unless a future task explicitly changes the taxonomy.
- Navigation visibility is separate from action permission.
- Planned routes must be marked planned/disabled. Do not point planned items to unrelated placeholder pages or generic report pages.
- Notifications may later move to the header, but remain in the sidebar for v1.

## Approved group order

1. HOME
2. MEMBEROPS
3. ENTRYOPS
4. FIELDOPS / RESOURCEOPS
5. GEAROPS
6. ADMIN

## Approved taxonomy

### HOME
Visible to: Admin, Program Manager, Coach, Assistant Coach, Guardian, Athlete, Limited Viewer

- Personal Dashboard — `/dashboard`
- FYP — `/feed`
- Notifications — `/notifications`

### MEMBEROPS
Visible to: Admin, Program Manager, Coach

- Programs — `/programs`
- People — `/people`
- Teams — `/teams`
- Membership Lifecycle — planned (`/member-ops/lifecycle`)
- Member Reports — planned (`/member-ops/reports`)

### ENTRYOPS
Visible to: Admin, Program Manager, Coach, Assistant Coach, Guardian, Athlete

- All — `/entries`
- Inbox — `/entries/inbox`
- Today — `/today`
- Lists — planned (`/lists`)
- Habits — `/habits`

### FIELDOPS / RESOURCEOPS
Visible to: Admin, Program Manager, Coach, Assistant Coach

- FieldOps — `/field-ops`
- Facilities — `/field-ops/facilities`
- Bookings — `/field-ops/bookings`
- Resources — `/field-ops/resources`
- Resource Requests — planned (`/field-ops/resource-requests`)
- Resource Reports — planned (`/field-ops/reports`)

### GEAROPS
Visible to: Admin, Program Manager, Coach, Assistant Coach, Guardian, Athlete

- Gear Dashboard — `/gear-ops`
- Items — `/gear-ops/items`
- Checkouts / Assignments — planned (`/gear-ops/checkouts`)
- Maintenance — planned (`/gear-ops/maintenance`)
- Categories — `/gear-ops/categories`
- Audits — `/gear-ops/audits`

Guardrail: Guardian and Athlete sidebar visibility for GearOps does not grant inventory-management actions. Create, edit, audit, approval, category, and maintenance mutations stay controlled by action permission helpers.

### ADMIN
Visible to: Admin, Program Manager

- Global Dashboard — planned (`/admin/dashboard`)
- Roles & Permissions — `/admin/roles`
- Settings — `/admin/settings`
- Prompts / Templates — `/prompts`
- Global Reports — planned (`/admin/reports`)
- Audit / History — `/admin/audit`

## Group visibility matrix

- ADMIN: HOME, MEMBEROPS, ENTRYOPS, FIELDOPS / RESOURCEOPS, GEAROPS, ADMIN
- PROGRAM_MANAGER: HOME, MEMBEROPS, ENTRYOPS, FIELDOPS / RESOURCEOPS, GEAROPS, ADMIN
- COACH: HOME, MEMBEROPS, ENTRYOPS, FIELDOPS / RESOURCEOPS, GEAROPS
- ASSISTANT_COACH: HOME, ENTRYOPS, FIELDOPS / RESOURCEOPS, GEAROPS
- GUARDIAN: HOME, ENTRYOPS, GEAROPS
- ATHLETE: HOME, ENTRYOPS, GEAROPS
- LIMITED_VIEWER: HOME only unless a future task explicitly expands visibility

## Item visibility notes

- Items inherit their group visibility unless a future taxonomy change adds an explicit item-level override.
- Planned and disabled items remain visible inside allowed groups so future module shape is discoverable without fake navigation.
- Sidebar filtering may use dev persona state, but the persona switcher must only change visibility filtering, not taxonomy structure.

## Regression protection

Navigation regression coverage lives in `/tmp/workspace/J2WFFDev/CadreOS/tests/navigation/nav-sidebar.test.ts` and `/tmp/workspace/J2WFFDev/CadreOS/lib/navigation/cadreos-nav-validation.ts`.
