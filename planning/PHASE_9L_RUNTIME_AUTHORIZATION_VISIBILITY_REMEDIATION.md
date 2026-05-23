# Phase 9L — Runtime Authorization / Visibility Remediation Summary

## Purpose

Phase 9L applies low-risk runtime hardening to the highest-priority authorization and visibility gaps identified in Phase 9K.

This phase remains intentionally conservative:

- No `Entry` runtime behavior is added.
- No `ObservationNote` or `FollowUpTask` migration is performed.
- No Feed, Inbox, Journal, messaging, notifications, or workflow automation runtime behavior is added.
- No guardian-facing feed, portal, or parent-facing runtime is added.
- Organization scoping remains the base boundary.
- Ambiguous visibility continues to deny/restrict by default.

## Runtime remediations completed

1. **People directory is now staff-only and scope-aware.**
   - `/people` now requires a staff role assignment.
   - Non-organization-scope staff only see people with matching team/program operational context.
   - Ambiguous staff scope assignments still deny the page rather than broadening access.

2. **Person detail is now scope-aware for non-org staff.**
   - `/people/[personId]` now evaluates derived person operational scope from current roster/team/program context.
   - Non-org staff are denied when the person has no matching team/program scope.
   - Person-linked related tasks, notes, attendance, and operational history queries are narrowed to the actor's resolved scope.

3. **Task detail no longer falls back to non-staff assignee/creator reads.**
   - `FollowUpTask` detail remains staff-facing only until a guardian/athlete task visibility policy is explicitly designed.
   - This removes the Phase 9K ownership fallback gap without introducing new guardian-facing behavior.

4. **Team detail now passes resolved program context into team-scope evaluation.**
   - Program directors no longer hit the safe-deny path solely because the team-program mapping was omitted at the call site.

5. **Dashboard and review queries are more consistently scoped.**
   - Program, team, and people counts are now narrowed to resolved staff scope for non-org staff.
   - Guardian-linkage review, team gap review, and dashboard operational history are now scope-filtered.
   - Pending FieldOps approval review remains organization-scoped only; non-org staff now receive a restricted view instead of an organization-wide summary.

## Remaining known gaps after Phase 9L

1. **Attendance still lacks a dedicated first-class visibility policy.**
   - Current runtime is safer because dashboard/person-linked attendance queries are scope-filtered.
   - A future phase still needs an explicit policy for attendance status/reason disclosure before any guardian-facing or Entry-era read expansion.

2. **Guardian-facing runtime remains intentionally deferred.**
   - Guardian linkage continues to support staff diagnostics only.
   - No guardian-linked read policy, consent model, or parent portal runtime exists yet.

3. **Entry readiness is improved but not complete.**
   - Current staff-facing notes/tasks/person/dashboard surfaces are less likely to leak cross-scope context.
   - Future `Entry` runtime work still requires explicit per-record visibility enforcement for attendance, guardian-facing reads, and any new cross-record summary surfaces.

## Validation guidance

Run and confirm:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `DATABASE_URL=postgresql://user:pass@localhost:5432/cadreos?schema=public ./node_modules/.bin/prisma validate`

Manual runtime checks:

- Confirm `/notes` and `/notes/[noteId]` still require staff access and keep `STAFF_ONLY` behavior only.
- Confirm `/tasks` and `/tasks/[taskId]` still work for staff, deny unresolved visibility context, and no longer allow non-staff ownership fallback reads.
- Confirm `/teams/[teamId]` still works for matching coaches and now allows valid program-director access.
- Confirm `/people` denies non-staff and narrows non-org staff to scoped people only.
- Confirm `/people/[personId]` denies non-org staff when the person has no matching scoped context and narrows related workflow summaries/history.
- Confirm dashboard cards, review panels, and operational history no longer show organization-wide people/team/guardian-gap data to scoped staff.
- Confirm FieldOps pending approval review remains organization-scoped rather than implicitly broadened.
- Confirm no guardian-facing dashboard, feed, inbox, journal, notification, messaging, or Entry runtime was introduced.

## Entry-readiness implications

Phase 9L reduces the likelihood that future Entry-era mixed visibility would inherit unsafe current read paths. It does not authorize Entry implementation yet. Before any Entry runtime begins, CadreOS still needs explicit attendance visibility policy, guardian-facing read boundaries, and broader per-record visibility coverage for any new mixed-scope workflow surfaces.
