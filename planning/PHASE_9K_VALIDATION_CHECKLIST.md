# Phase 9K — Manual Validation Checklist

Use this checklist to confirm the Phase 9K matrix still matches the current runtime before Entry work begins.

## Documentation validation

- [ ] `planning/PHASE_9K_AUTHORIZATION_VISIBILITY_VALIDATION_MATRIX.md` reflects current 9D–9J behavior, not proposed future Entry behavior.
- [ ] The matrix documents all required actor types:
  - organization admin
  - program director
  - coach
  - assistant coach
  - athlete
  - linked guardian
  - unrelated guardian
  - unauthenticated user where applicable
- [ ] The matrix documents all required record/workflow types:
  - ObservationNote
  - FollowUpTask
  - Event
  - AttendanceRecord
  - Person / roster context
  - guardian relationship context
  - dashboard / review summaries

## Authentication boundary checks

- [ ] Unauthenticated access to `/dashboard`, `/people`, `/teams`, `/events`, `/notes`, and `/tasks` is blocked by middleware.
- [ ] Linked non-staff users are denied on staff-only notes, events, attendance, dashboard, and guardian-diagnostic surfaces.
- [ ] Unresolved person-link accounts are still handled safely and do not gain staff-only access through helper fallbacks.

## ObservationNote checks

- [ ] Notes list remains staff-only.
- [ ] Notes detail remains staff-only.
- [ ] Supported note visibility remains limited to `STAFF_ONLY`.
- [ ] Unsupported or unresolved note visibility is denied with a safe fallback.
- [ ] Program/team-scoped staff only see notes within their resolved scope.
- [ ] Non-org-scope staff do not see organization-scoped notes.

## FollowUpTask checks

- [ ] Tasks list remains staff-only.
- [ ] Tasks detail enforces linked visibility classification and denies unresolved task visibility context.
- [ ] Program/team-scoped staff only see tasks within their resolved source note/event scope.
- [ ] Non-org-scope staff do not see organization-scoped/standalone tasks.
- [ ] Non-staff direct task-detail ownership behavior is still documented as an implementation gap if present.

## Event / attendance checks

- [ ] Events list/detail remain staff-only.
- [ ] Program/team-scoped staff only see events within resolved scope.
- [ ] Attendance remains readable only through current staff workflows.
- [ ] No athlete self-attendance or guardian attendance runtime was introduced.
- [ ] Attendance reason/status disclosure still matches the matrix assumptions.

## Person / roster / guardian context checks

- [ ] People list behavior still matches the matrix, including whether non-staff can load the directory.
- [ ] Person detail behavior still matches the matrix, including current lack of scope narrowing.
- [ ] Team detail behavior still matches the matrix, including current program-director edge cases.
- [ ] Guardian relationship diagnostics remain staff-only.
- [ ] Assistant coaches can view but not edit guardian linkage where edit support exists.

## Dashboard / review summary checks

- [ ] Dashboard remains staff-only.
- [ ] Scoped event/note/task dashboard panels still narrow to resolved staff scope.
- [ ] Organization-wide aggregates that remain broader than scoped panels are still documented as gaps.
- [ ] No guardian-facing dashboard/review summary runtime was introduced.

## Negative-scope / future-boundary checks

- [ ] No Entry runtime behavior was added.
- [ ] No ObservationNote / FollowUpTask migration was added.
- [ ] No Feed / Inbox / Journal runtime behavior was added.
- [ ] No messaging / notification / workflow automation runtime behavior was added.
- [ ] No guardian-facing feed or parent portal behavior was added.

## Testing expectation

- [ ] No new test framework was introduced just for this validation pass.
- [ ] If no focused automated test pattern exists for this matrix coverage, manual validation remains the documented validation path.
