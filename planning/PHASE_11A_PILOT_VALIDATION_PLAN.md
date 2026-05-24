# Phase 11A — Pilot Validation Plan and Build/Deployment Verification

## Goal

Create a pilot-readiness validation plan and deployment verification checklist for the current CadreOS MVP after Operational Foundation closeout and minimal Entry runtime work, without adding runtime product scope.

## Scope Guardrails (must remain enforced)

- Do not add new product features.
- Do not expand Entry runtime behavior.
- Do not migrate `ObservationNote` or `FollowUpTask`.
- Do not implement Feed, Inbox, Journal, messaging, notifications, or workflow automation runtime behavior.
- Do not expand FieldOps beyond current MVP behavior.
- Keep this phase focused on pilot readiness, validation, deployment verification, and risk tracking.
- Do not introduce new major dependencies.

## Implementation Baseline Reviewed (current MVP state)

The following implemented areas were re-verified against current route and helper behavior:

1. **Core organization/program/team/person model**
   - People/programs/teams/seasons routes and scoped data loading are active.
2. **Roles and assignments**
   - Role assignment create/delete workflows are active in people/team surfaces.
3. **Roster/member management**
   - Team roster add/remove workflows are active and organization-scoped.
4. **Guardian visibility**
   - Guardian relationship visibility remains staff-role-gated.
5. **Events/attendance**
   - Event create/list/detail/edit plus RSVP/attendance capture routes are active.
6. **ObservationNotes**
   - Notes create/list/detail/edit remain active operational records.
7. **FollowUpTasks**
   - Tasks create/list/detail/edit remain active operational records.
8. **Dashboard/review workflows**
   - Dashboard includes operational review/readiness/history pathways.
9. **FieldOps MVP**
   - Facilities/resources/bookings/approval surfaces remain active at MVP scope.
10. **Minimal Entry wrapper/runtime context**
    - Note/task sidecar wrapper context and read-only `/entry-runtime/[entryRuntimeRefId]` view are active.

## Pilot Validation Plan

### A) Must be tested before demo

- Authentication/session continuity for staff users and unresolved person-link redirects.
- Staff-role access to dashboard, team, event, note, and task workflows.
- Roster context review (team members, staff assignments, season context).
- Guardian linkage visibility indicators in team/person/note/task contexts.
- Event create and attendance capture workflow continuity.
- Observation note creation and detail review continuity.
- Follow-up task creation and status/update continuity.
- Dashboard review panels and route-link continuity.
- Entry wrapper read-only linkage visibility from note/task detail when wrapper metadata exists.
- No regression in FieldOps overview/bookings visibility at current MVP scope.

### B) Must be tested before real pilot

- Cross-role authorization boundary checks (admin/program director/coach/assistant coach/guardian/athlete/unlinked account).
- Organization scoping integrity across all core route families.
- Multi-step operational continuity: roster → event → attendance → note → task → dashboard.
- Negative-path validation (unauthorized writes, invalid payloads, missing context, unresolved visibility).
- Entry sidecar behavior toggles:
  - flags off: note/task workflows unaffected
  - flags on: wrapper metadata remains non-blocking and non-authoritative
- FieldOps booking conflict/approval pathways in realistic data scenarios.
- Build/deploy verification checklist execution in the target environment.
- Seed/demo data reset and repeatability checks.

### C) Can remain temporarily untested (non-blocking for this pilot phase)

- Feed/Inbox/Journal runtime behavior (still deferred).
- Messaging, notification/reminder delivery behavior (still deferred).
- Workflow automation/escalation behavior (still deferred).
- Parent/guardian-facing runtime portal/feed behavior (still deferred).
- Full Entry migration behavior (still deferred; note/task remain authoritative).
- Advanced analytics/reporting infrastructure behavior (still deferred).

### D) Pilot usage blockers

Pilot usage is blocked if any of the following are true:

- Staff cannot reliably complete roster → event → attendance → note → task → dashboard workflow.
- Authorization/scoping defects allow cross-scope data exposure or unauthorized writes.
- Core create/update workflows for events, attendance, notes, or tasks fail in target deploy.
- Entry wrapper/context surfaces mutate authoritative runtime behavior or block note/task operations.
- Build/deployment checks fail (type/build/deploy status/db/env/seed/branch policy).
- Database connection, Prisma generation/validation, or essential environment configuration is unstable.

## Build/Deployment Verification Checklist

Use this checklist per release candidate and before pilot sessions.

### Local build and static validation

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

### Prisma and schema checks

- [ ] `DATABASE_URL=... npm run prisma:generate`
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate`
- [ ] Confirm Prisma Client generation succeeds with repository-pinned Prisma version.

### Database connection and readiness

- [ ] Validate configured `DATABASE_URL` can reach the intended environment database.
- [ ] Confirm `/api/health/db` indicates healthy DB connectivity in deployed environment.
- [ ] Confirm organization-scoped dashboard loads without schema readiness warnings.

### Vercel deployment status

- [ ] Confirm latest branch preview deployment is `Ready` with successful build logs.
- [ ] Confirm production deployment health for `main` is `Ready`.
- [ ] Confirm no unresolved 5xx runtime errors for dashboard/core workflow routes in deployment logs.

### Seed/demo data readiness

- [ ] Confirm baseline seed path is available (`DATABASE_URL=... npm run prisma:seed`) for demo/pilot setup.
- [ ] Confirm seeded/demo organization includes at least one valid staff account linkage path.
- [ ] Confirm demo data includes a runnable roster + event + attendance + note + task path.

### Environment variable verification

- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`
- [ ] `CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE`
- [ ] `CADREOS_ENTRY_RUNTIME_TASKS_SIDECAR_WRITE`

### Branch deployment policy verification

- [ ] Confirm `main` remains deployment-enabled.
- [ ] Confirm branches containing `copilot` remain excluded from Vercel preview builds.
- [ ] Confirm non-`copilot` branches continue normal preview deployment behavior.

## End-to-End Manual Scenario Test Script (Coach Workflow)

Use one staff-linked coach account and one existing team with rosterable athletes.

1. **Create/review roster context**
   - Open `/teams/[teamId]`.
   - Confirm selected season context, roster list, and role assignments are visible.
   - Add an athlete to roster (if missing) and confirm roster update.
2. **Review guardian linkage**
   - In team roster/person context, confirm guardian relationship indicators are visible for staff roles.
   - Verify guardian context remains informational and staff-gated.
3. **Create/review event**
   - Create an event from `/events/new`.
   - Open `/events/[eventId]` and confirm team/program linkage and event metadata.
4. **Capture attendance**
   - Submit attendance from `/events/[eventId]/attendance`.
   - Re-open event detail and confirm attendance summary/state updates.
5. **Create observation note**
   - Create note from `/notes/new` linked to athlete/team/event context.
   - Confirm note appears in `/notes` and detail view.
6. **Create follow-up task**
   - Create task from `/tasks/new`, linking source note/event where applicable.
   - Confirm task appears in `/tasks` and detail view with expected status/due context.
7. **Review dashboard/operational summaries**
   - Open `/dashboard`.
   - Confirm event/note/task/review panels reflect newly created operational data.
8. **Inspect Entry wrapper/context where applicable**
   - Open note/task detail pages and check Entry wrapper summary panel (if wrapper metadata exists).
   - Navigate to `/entry-runtime/[entryRuntimeRefId]`.
   - Confirm view is read-only metadata/context and does not provide create/edit/delete controls.

## Validation Debt Register

### Known not tested (as of this phase output)

- Full runtime behavior for Feed/Inbox/Journal.
- Messaging/notification/reminder runtime channels.
- Workflow automation/escalation runtime behavior.
- Parent/guardian-facing portal/feed runtime behavior.
- Full Entry migration/cutover behavior.

### Partially tested

- Cross-role access boundary coverage across all route-level edge cases.
- Entry sidecar behavior across all toggle and partial-data combinations.
- FieldOps conflict and approval edge scenarios under larger realistic datasets.

### High-risk unvalidated areas

- Authorization/scoping edge cases that could expose out-of-scope operational data.
- Multi-step continuity regressions across roster/event/attendance/note/task/dashboard transitions.
- Environment/deployment misconfiguration causing pilot-day runtime instability.

### Lower-risk deferred areas

- Advanced analytics/reporting architecture behavior.
- Non-MVP communication and workflow automation architecture.
- Parent-facing experience expansion beyond current staff-gated operational context.

## Pilot Blockers

- Any unresolved P0/P1 defects in core staff workflows (roster, event, attendance, note, task, dashboard).
- Any unresolved authorization or organization-scope leakage issue.
- Build/deployment verification checklist not fully passing for target pilot environment.
- DB/env configuration instability that causes intermittent workflow failure.
- Entry wrapper/context behavior causing authoritative workflow regressions.

## Safe to Continue Building

Continue post-pilot feature planning/building only when:

- Core coach workflow script passes end-to-end without blockers in target deployment.
- Authorization/scoping checks pass for required staff and non-staff personas.
- Build/deployment checklist is consistently green across local and Vercel targets.
- Entry wrapper remains additive/read-only-context and does not alter note/task authority.
- Validation debt items are triaged with explicit owners and phase targets.

## Documentation-to-Implementation Alignment Notes

- Current planning statements align with route-level implementation for dashboard, teams/roster, events/attendance, notes/tasks, FieldOps, and read-only entry-runtime context.
- This phase introduces documentation/index updates only; no runtime product behavior was added or expanded.

## Source references

- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `app/(dashboard)/teams/[teamId]/roster/route.ts`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/events/[eventId]/attendance/route.ts`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `app/(dashboard)/entry-runtime/[entryRuntimeRefId]/page.tsx`
- `app/(dashboard)/field-ops/page.tsx`
- `lib/guardian-relationship-access.ts`
- `planning/PHASE_8P_OPERATIONAL_FOUNDATION_MVP_CLOSEOUT.md`
- `planning/PHASE_10E_ENTRY_RUNTIME_STABILIZATION_CLOSEOUT.md`
- `package.json`
- `.env.example`
- `README.md`
- `vercel.json`

## PR Summary

Phase 11A adds a pilot-readiness validation package for the current CadreOS MVP: a bounded pilot validation plan, build/deployment verification checklist, end-to-end coach scenario script, validation debt register, pilot blockers, and safe-to-continue-building criteria. The update reaffirms that Operational Foundation workflows (`ObservationNote`/`FollowUpTask` as authoritative), FieldOps MVP scope, and minimal Entry wrapper/read-only context remain unchanged. Remaining risk is concentrated in execution depth (cross-role authorization edge validation, deployment/environment consistency, and multi-step continuity regression coverage), not in new runtime scope.
