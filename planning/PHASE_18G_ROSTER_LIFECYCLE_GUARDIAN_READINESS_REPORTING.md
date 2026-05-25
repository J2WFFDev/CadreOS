# Phase 18G — Roster Lifecycle and Guardian Readiness Reporting

## Goal

Continue Arc 18 runtime delivery with staff-scoped, read-only roster lifecycle and guardian readiness operational reporting visibility using existing Arc 17 lifecycle, roster, guardian relationship, team, program, and season data.

This phase expands operational visibility only. It does not add workflow mutations, exports, messaging, automation, external integrations, or financial reporting.

---

## Scope Delivered

### 1) Dashboard lifecycle/guardian readiness expansion

Dashboard lifecycle readiness reporting now includes practical lifecycle operational gap rollups built from existing staff-scoped counts:

- Lifecycle status distribution continuity (active/prospect/inactive/archived/alumni)
- Active members lacking roster membership visibility
- Guardian linkage gap visibility continuity
- Lifecycle operational gap rollup summary for readiness review

### 2) Program and season roster readiness expansion

Program detail and program listing surfaces now include selected-season readiness visibility where practical:

- Selected-season lifecycle distribution summaries
- Selected-season roster member totals
- Selected-season members not currently active in lifecycle status
- Selected-season athlete guardian-coverage gap summaries
- Practical member-level drill-down links into existing people/team surfaces
- Safe empty states when seasons or roster context are missing

### 3) Team readiness summary expansion

Team summary cards now include additional selected-season readiness visibility where practical:

- Lifecycle status distribution summaries
- Members not currently active in lifecycle status
- Athlete rows missing guardian relationships
- Existing roster/assignment readiness continuity

### 4) Read-only posture and workflow continuity preserved

All Arc 18G additions remain:

- Read-only
- Organization-scoped through existing organization context
- Staff-scoped through existing authorization patterns
- Linked into existing people/program/team workflows for safe navigation

No lifecycle, guardian-maintenance, attendance, FieldOps, or GearOps mutation workflows were changed.

---

## Authorization and Privacy

Arc 18G reporting follows Arc 18A–18F boundaries:

- Staff-only reporting visibility preserved
- Existing role/scope evaluation patterns preserved
- No guardian/parent reporting surface introduced
- No private staff-note visibility expansion introduced

---

## Workflow and Domain Preservation

This phase does **not** change mutation behavior in:

- Arc 17 lifecycle workflows
- Guardian relationship maintenance workflows
- Attendance/event workflows
- FieldOps workflows
- GearOps workflows

Reporting additions are read-only overlays over existing relational data.

---

## Constraints Confirmed

- No export implementation added
- No messaging/notifications added
- No AI/automation added
- No external integrations added
- No workflow mutations added
- No financial reporting added
- No Prisma schema expansion required

---

## Validation Commands

Arc 18G validation uses:

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
- `planning/PHASE_18F_VALIDATION_CHECKLIST.md`
- `planning/PHASE_17I_ROSTER_MEMBER_LIFECYCLE_CLOSEOUT.md`
- `prisma/schema.prisma`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/programs/page.tsx`
- `app/(dashboard)/programs/[programId]/page.tsx`
- `app/(dashboard)/teams/page.tsx`
- `app/(dashboard)/people/page.tsx`
- `lib/organization-context.ts`
- `lib/authorization/index.ts`
- `lib/guardian-relationship-access.ts`

---

## Arc 18G Output Summary

Phase 18G adds staff-scoped, read-only roster lifecycle and guardian readiness reporting visibility across dashboard, program/season context, and team readiness summaries with lifecycle distribution, guardian coverage, selected-season readiness, and practical lifecycle operational gap visibility while preserving authorization boundaries and existing workflow behavior.
