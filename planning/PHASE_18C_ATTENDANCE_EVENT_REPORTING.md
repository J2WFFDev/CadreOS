# Phase 18C — Attendance and Event Reporting

## Goal

Continue Arc 18 runtime delivery with staff-scoped, read-only attendance and event operational reporting using existing attendance, RSVP, roster, lifecycle, team, program, and season data.

This phase expands visibility only. It does not add workflow mutations, exports, messaging, automation, external integrations, or financial reporting.

---

## Scope Delivered

### 1) Dashboard attendance and event reporting expansion

Dashboard reporting now adds:

- Recent attendance trend visibility across sampled recent team events
- Upcoming event readiness visibility using roster-based RSVP response gaps and open follow-up context
- Safe links into existing event attendance review and readiness lanes

### 2) Program and team attendance/event reporting sections

Program and team detail views now include staff-scoped, read-only reporting sections for:

- Recent attendance participation trend summaries
- Complete/partial/missing attendance coverage counts
- Upcoming event readiness summaries
- No-response RSVP visibility where roster expectation exists
- Safe links into existing event and team pages

### 3) Event detail participation and readiness reporting

Event detail now exposes additional operational reporting visibility for:

- Attendance participation totals and capture rate
- RSVP response totals and no-response visibility
- Present/late/absent participation distribution
- Upcoming readiness or missing-attendance review cues, depending on event timing

### 4) Read-only posture preserved

All added attendance/event reporting remains:

- Organization-scoped
- Staff-scoped where reporting visibility is added
- Read-only
- Routed through existing event, team, program, note, and task workflows for follow-up

---

## Authorization and Privacy

Arc 18C reporting follows Arc 18A and 18B boundaries:

- Staff-only reporting visibility
- Existing organization scoping preserved
- Existing role and scope resolution patterns preserved
- No guardian/parent reporting visibility introduced
- No private staff-note exposure beyond existing authorization rules

---

## Workflow and Domain Preservation

This phase does **not** change mutation behavior in:

- Attendance capture workflows
- RSVP workflows
- Lifecycle workflows
- FieldOps
- GearOps

Reporting additions are read-only overlays using current workflow data.

---

## Constraints Confirmed

- No export implementation added
- No messaging or notifications added
- No AI or automation added
- No external integrations added
- No workflow mutations added
- No financial reporting added
- No Prisma schema expansion required

---

## Validation Commands

Arc 18C validation uses:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos ./node_modules/.bin/prisma validate`

---

## Source References

- `planning/PHASE_18A_OPS_REPORTING_ARCHITECTURE_BOUNDARIES.md`
- `planning/PHASE_18B_CORE_OPERATIONAL_SUMMARY_REPORTS.md`
- `planning/PHASE_18B_VALIDATION_CHECKLIST.md`
- `planning/PHASE_17I_ROSTER_MEMBER_LIFECYCLE_CLOSEOUT.md`
- `prisma/schema.prisma`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/events/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/programs/[programId]/page.tsx`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `lib/attendance-event-reporting.ts`
- `lib/organization-context.ts`
- `lib/authorization/index.ts`

---

## Arc 18C Output Summary

Phase 18C adds staff-scoped, read-only attendance and event operational reporting visibility on dashboard, team, program, and event detail surfaces with participation, readiness, no-response, and recent-trend summaries derived from existing CadreOS data while preserving existing authorization boundaries and workflow behavior.
