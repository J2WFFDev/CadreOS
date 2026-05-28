# NAV-006: Limited-role navigation

## Objective

Validate role-based module/action visibility using the dev persona switcher.

## Setup

- Set `NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true` in `.env.local`
- Restart the app
- Use header control: **Dev Persona**

## Persona expectations

### Admin
- Expected visible modules: Dashboard, MemberOps, Entry, Journal, GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected hidden modules: none
- Expected allowed actions: all staff actions
- Expected blocked actions: none

### Program Manager
- Expected visible modules: Dashboard, MemberOps, Entry, Journal, GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected hidden modules: none
- Expected allowed actions: program/team management, season management, approvals, roster/member management
- Expected blocked actions: organization-admin-only governance tasks

### Coach
- Expected visible modules: Dashboard, MemberOps, Entry, Journal, GearOps, FieldOps, Audit/History
- Expected hidden modules: Admin/Settings
- Expected allowed actions: roster operations, entries, notes/tasks, event operations, gear operations
- Expected blocked actions: admin settings, booking approvals/denials, role assignment management

### Assistant Coach
- Expected visible modules: Dashboard, MemberOps, Entry, Journal
- Expected hidden modules: GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected allowed actions: attendance updates, note/task create/update, entry create/update
- Expected blocked actions: admin/member management, gear operations, booking decisions

### Guardian
- Expected visible modules: Dashboard
- Expected hidden modules: MemberOps, Entry, Journal, GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

### Athlete
- Expected visible modules: Dashboard
- Expected hidden modules: MemberOps, Entry, Journal, GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

### Limited Viewer
- Expected visible modules: Dashboard
- Expected hidden modules: MemberOps, Entry, Journal, GearOps, FieldOps, ResourceOps, Admin/Settings, Audit/History
- Expected allowed actions: none (read-only experience)
- Expected blocked actions: all staff mutations

## Pass criteria

- Persona switch updates nav to expected modules
- Hidden modules are not reachable through guarded routes
- Limited Viewer cannot access admin/staff-only modules/actions
- Switching personas does not require Clerk logout/login
