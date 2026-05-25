# Phase 18H — Export-Friendly Reporting Views

## Goal

Deliver staff-scoped, read-only export-friendly operational reporting views that organize existing Core MVP, attendance/event, notes/task, FieldOps, GearOps, and lifecycle/guardian readiness data into structured layouts suitable for future export generation.

This phase adds report-oriented presentation only. It does not add CSV/PDF generation, scheduled delivery, messaging, automation, workflow mutations, financial reporting, or external integrations.

---

## Scope Delivered

### 1) Staff-only export-friendly reporting surface

A new `/reports` dashboard surface now provides a consolidated, read-only reporting view that is:

- Organization-scoped via existing organization-context helpers
- Staff-scoped via existing authorization patterns
- Structured for print/export-oriented consumption (tabular sections)
- Linked to existing operational workflows for safe drill-down

### 2) Structured report sections

The new report surface includes practical structured sections for:

- Operational summary metrics (program/team/people/workload/readiness counts)
- Attendance and event reporting rows
- Notes and follow-up task operational review rows
- FieldOps booking/readiness reporting rows
- GearOps low-availability and custody reporting rows
- Lifecycle distribution and guardian readiness reporting rows

### 3) Export-oriented layout organization

Where practical, reporting is organized into simple table/list layouts that are easy to parse, print, and map to future export workflows without introducing export delivery runtime.

### 4) Safe navigation continuity

Reporting rows and section actions include practical links into existing CadreOS operational pages (dashboard/events/notes/tasks/FieldOps/GearOps/people/teams) so review workflows remain continuous and non-disruptive.

---

## Authorization and Privacy

Arc 18H reporting follows Arc 18A–18G boundaries:

- Staff-only reporting visibility preserved
- Existing organization scoping preserved
- Existing role/scope evaluation patterns preserved
- No guardian/parent reporting surface introduced
- No private staff-note content expansion beyond existing staff authorization boundaries

---

## Workflow and Domain Preservation

This phase does **not** change mutation behavior in:

- Core lifecycle workflows
- Attendance/event workflows
- Notes/task workflows
- FieldOps workflows
- GearOps workflows
- Guardian relationship maintenance workflows

Reporting additions are read-only overlays over existing relational data and routes.

---

## Constraints Confirmed

- No CSV/PDF export generation added
- No scheduled report delivery added
- No messaging/notifications added
- No AI/automation added
- No external integrations added
- No workflow mutations added
- No financial reporting added
- No Prisma schema expansion required

---

## Validation Commands

Arc 18H validation uses:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos ./node_modules/.bin/prisma validate`

---

## Source References

- `planning/PHASE_18A_OPS_REPORTING_ARCHITECTURE_BOUNDARIES.md`
- `planning/PHASE_18B_CORE_OPERATIONAL_SUMMARY_REPORTS.md`
- `planning/PHASE_18C_ATTENDANCE_EVENT_REPORTING.md`
- `planning/PHASE_18D_NOTES_TASK_OPERATIONAL_REVIEW_REPORTING.md`
- `planning/PHASE_18E_FIELDOPS_REPORTING.md`
- `planning/PHASE_18F_GEAROPS_REPORTING.md`
- `planning/PHASE_18G_ROSTER_LIFECYCLE_GUARDIAN_READINESS_REPORTING.md`
- `planning/PHASE_18G_VALIDATION_CHECKLIST.md`
- `prisma/schema.prisma`
- `app/(dashboard)/reports/page.tsx`
- `components/nav-sidebar.tsx`
- `lib/organization-context.ts`
- `lib/authorization/index.ts`
- `lib/operational-visibility.ts`

---

## Arc 18H Output Summary

Phase 18H adds a staff-scoped, read-only export-friendly reporting surface with structured operational tables across core summary, attendance/events, notes/tasks, FieldOps, GearOps, and lifecycle/guardian readiness domains, while preserving existing authorization boundaries, organization scoping, and all existing operational mutation workflows.
