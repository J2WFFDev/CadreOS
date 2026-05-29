# NAV-006: Sidebar persona navigation

## Objective

Validate sidebar group visibility using the dev persona switcher and the approved taxonomy in `docs/navigation/sidebar-taxonomy.md`.

## Setup

- Set `NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true` in `.env.local`
- Restart the app
- Use header control: **Dev Persona**

## Persona expectations

### Admin
- Expected visible groups: Home, MemberOps, EntryOps, FieldOps / ResourceOps, GearOps, Admin
- Expected hidden modules: none
- Expected allowed actions: all staff actions
- Expected blocked actions: none

### Program Manager
- Expected visible groups: Home, MemberOps, EntryOps, FieldOps / ResourceOps, GearOps, Admin
- Expected hidden modules: none
- Expected allowed actions: program/team management, season management, approvals, roster/member management
- Expected blocked actions: organization-admin-only governance tasks

### Coach
- Expected visible groups: Home, MemberOps, EntryOps, FieldOps / ResourceOps, GearOps
- Expected hidden groups: Admin
- Expected allowed actions: roster operations, entries, notes/tasks, event operations, gear operations
- Expected blocked actions: admin settings, booking approvals/denials, role assignment management

### Assistant Coach
- Expected visible groups: Home, EntryOps, FieldOps / ResourceOps, GearOps
- Expected hidden groups: MemberOps, Admin
- Expected allowed actions: attendance updates, note/task create/update, entry create/update
- Expected blocked actions: admin/member management, gear operations, booking decisions

### Guardian
- Expected visible groups: Home, EntryOps, GearOps
- Expected hidden groups: MemberOps, FieldOps / ResourceOps, Admin
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

### Athlete
- Expected visible groups: Home, EntryOps, GearOps
- Expected hidden groups: MemberOps, FieldOps / ResourceOps, Admin
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

### Limited Viewer
- Expected visible groups: Home
- Expected hidden groups: MemberOps, EntryOps, FieldOps / ResourceOps, GearOps, Admin
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

## Pass criteria

- Persona switch updates sidebar to the expected approved groups
- Hidden modules are not reachable through guarded routes
- Limited Viewer cannot access admin/staff-only modules/actions
- Switching personas does not require Clerk logout/login
