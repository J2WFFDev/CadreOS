# Phase 9K — Authorization / Visibility Validation Matrix (Current Operational Workflows)

## Purpose

Phase 9K validates current authorization and visibility behavior across the active operational workflows before any `Entry` runtime implementation begins.

This phase is validation-focused only:

- No `Entry` model/runtime behavior is added.
- No `ObservationNote` or `FollowUpTask` migration is performed.
- No Feed, Inbox, Journal, messaging, notifications, or workflow automation runtime behavior is added.
- No guardian-facing feed or parent portal behavior is added.
- No broad schema redesign is performed.
- Organization scoping remains the base boundary.
- No new major dependencies are introduced.

## Validation basis

This matrix was checked against the current Phase 9D–9J implementation shape, especially:

- `middleware.ts`
- `lib/organization-context.ts`
- `lib/authorization/index.ts`
- `lib/guardian-relationship-access.ts`
- `lib/operational-visibility.ts`
- `lib/operational-history.ts`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/events/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/notes/page.tsx`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `app/(dashboard)/people/page.tsx`
- `app/(dashboard)/people/[personId]/page.tsx`
- `app/(dashboard)/teams/[teamId]/page.tsx`

## Phase 9D–9J review summary

- Phase 9D defined the target visibility architecture and deferred guardian-facing reads.
- Phase 9E added read-path role resolution and initial staff-only gates.
- Phase 9F expanded those gates across current operational pages.
- Phase 9G added structured authorization-decision logging for troubleshooting.
- Phase 9H hardened scope defaults and deny-on-ambiguity behavior.
- Phase 9I added operational visibility classification for current notes/tasks.
- Phase 9J hardened linked-record visibility inheritance for task workflows.

The current runtime remains intentionally narrow:

- `ObservationNote` is only supported operationally as `STAFF_ONLY`.
- `FollowUpTask` visibility is still derived from linked note/event context.
- Event, attendance, person, roster, and dashboard visibility are still mostly route/scope based rather than first-class per-record visibility based.
- Guardian access is still enforced primarily by absence of guardian-facing read paths plus staff-only guardian diagnostic gating.

---

## Validation matrix

### 1. ObservationNote

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed on notes list/detail within the same organization. | Denied only for unsupported/unresolved note visibility or cross-org access. | Organization scope. | Only `STAFF_ONLY` notes are supported/readable. | Organization-scoped notes and team-scoped notes both pass for org admins. |
| Program director | Allowed for note records whose resolved team/program context matches one of the actor's program assignments. | Denied for other programs, unresolved visibility context, and organization-scoped notes with no org-scope assignment. | Matching program scope, derived from note/team/event links. | `STAFF_ONLY` only; unsupported values deny by default. | Organization-scoped notes are intentionally hidden from non-org-scope staff. |
| Coach | Allowed for note records whose resolved team context matches one of the actor's team assignments. | Denied for other teams, organization-scoped notes, and unresolved visibility context. | Matching team scope. | `STAFF_ONLY` only; unsupported values deny by default. | List and detail flows both narrow by staff scope. |
| Assistant coach | Same as coach for reads. | Same as coach for reads. | Matching team scope. | `STAFF_ONLY` only; unsupported values deny by default. | Read access is broader than assistant-coach event write permissions; this is current behavior. |
| Athlete | Denied on note list/detail. | Denied because notes are staff-only. | No supported scope. | No athlete-readable note visibility exists. | Direct guardian/athlete note read path is not implemented. |
| Linked guardian | Denied on note list/detail. | Denied because notes are staff-only. | No supported scope. | No guardian-readable note visibility exists. | Guardian linkage is not used for note reads yet. |
| Unrelated guardian | Denied on note list/detail. | Denied because notes are staff-only. | No supported scope. | No guardian-readable note visibility exists. | Same denial as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to all `/notes` routes. |

### 2. FollowUpTask

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed on tasks list/detail within the same organization when linked visibility context resolves safely. | Denied for unresolved/unsupported linked visibility context or cross-org access. | Organization scope. | Tasks inherit operational visibility from linked note/event context; no stored task visibility field exists. | Standalone organization-scoped tasks remain visible to org admins. |
| Program director | Allowed for tasks whose linked event/note program context matches the actor's program assignments. | Denied for other programs, unresolved linked visibility, and organization-scoped/standalone tasks with no org-scope assignment. | Matching program scope derived from source event/source note links. | Source-note visibility must be supported; unresolved inheritance denies by default. | Current list/detail behavior hides organization-scoped tasks from non-org-scope staff. |
| Coach | Allowed for tasks whose linked team context matches one of the actor's team assignments. | Denied for other teams, organization-scoped/standalone tasks, and unresolved linked visibility. | Matching team scope. | Derived task visibility only; no direct task visibility setting exists. | Team/program inference comes from source event/source note relationships. |
| Assistant coach | Same as coach for reads. | Same as coach for reads. | Matching team scope. | Derived task visibility only. | Read access exists even though assistant coaches do not have full event write permissions. |
| Athlete | Denied from task list in current workflows. | Denied unless the actor is directly the task assignee or creator on detail view. | No supported general scope. | No athlete-facing task visibility category exists. | `tasks/[taskId]` detail currently allows linked non-staff assignee/creator access if such a record exists. |
| Linked guardian | Denied from task list in current workflows. | Denied unless the actor is directly the task assignee or creator on detail view. | No supported general scope. | No guardian-facing task visibility category exists. | Detail helper is more permissive than the staff-only task list and should be treated as a gap before broader guardian runtime. |
| Unrelated guardian | Denied from task list in current workflows. | Denied unless the actor is directly the task assignee or creator on detail view. | No supported general scope. | No guardian-facing task visibility category exists. | If an unrelated guardian somehow owned a task record, direct detail access would still follow assignee/creator logic. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to all `/tasks` routes. |

### 3. Event

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed on event list/detail in the same organization. | Denied only for cross-org access. | Organization scope. | Events do not have a first-class visibility field; access is staff + scope based. | Draft events are still readable by staff; no draft visibility restriction exists. |
| Program director | Allowed for events in assigned programs. | Denied for events outside assigned programs and for organization-scoped records without org scope. | Matching program scope. | Event visibility is inferred from program/team scope only. | Event detail correctly passes program context into team-scope evaluation. |
| Coach | Allowed for team-linked events in assigned teams. | Denied for events outside assigned teams and for organization-scoped records without org scope. | Matching team scope. | Event visibility is inferred from team/program scope only. | Teamless events are effectively org-scope only. |
| Assistant coach | Allowed for reads in assigned teams. | Denied outside assigned teams and for org-scoped records without org scope. | Matching team scope. | Event read paths treat assistant coaches as staff. | Assistant coaches can read event workflows even though event mutation permissions are narrower. |
| Athlete | Denied on event operational routes. | Denied because event pages are staff-only operational surfaces. | No supported scope. | No athlete event portal is implemented. | RSVP action types exist in permissions, but guardian/athlete RSVP runtime is not implemented. |
| Linked guardian | Denied on event operational routes. | Denied because guardian-facing event reads are not implemented. | No supported scope. | No guardian event portal is implemented. | Relationship linkage is not used for event reads. |
| Unrelated guardian | Denied on event operational routes. | Denied because guardian-facing event reads are not implemented. | No supported scope. | No guardian event portal is implemented. | Same denial as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to all `/events` routes. |

### 4. AttendanceRecord

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed through event detail, dashboard review, and person/team operational history in the same organization. | Denied only for cross-org access. | Organization scope. | Attendance has no first-class visibility field. | Sensitive reason/status details are shown on staff routes with no partial-disclosure layer. |
| Program director | Allowed through program-matching event/dashboard/team workflows. | Denied for event/team surfaces outside assigned programs. | Matching program scope on event/team/dashboard surfaces. | Attendance reads inherit the containing workflow's scope rules. | Person detail operational history is broader and can expose person-linked attendance outside program scope. |
| Coach | Allowed through matching team event/detail/dashboard workflows. | Denied for event/team surfaces outside assigned teams. | Matching team scope on event/team/dashboard surfaces. | Attendance reads inherit containing workflow scope. | Person detail remains staff-only but not team-scoped, which is broader than other attendance views. |
| Assistant coach | Same as coach for reads. | Same as coach for reads. | Matching team scope on event/team/dashboard surfaces. | Attendance reads inherit containing workflow scope. | Assistant coaches can read attendance detail on staff surfaces. |
| Athlete | Denied in current runtime. | Denied because no athlete self-attendance read surface exists. | No supported scope. | No athlete attendance visibility policy exists yet. | This remains an unresolved product/auth decision. |
| Linked guardian | Denied in current runtime. | Denied because no guardian attendance read surface exists. | No supported scope. | No guardian attendance visibility policy exists yet. | Guardian linkage is not yet used to expose attendance. |
| Unrelated guardian | Denied in current runtime. | Denied because no guardian attendance read surface exists. | No supported scope. | No guardian attendance visibility policy exists yet. | Same denial as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to current attendance surfaces inside dashboard/event routes. |

### 5. Person / roster context

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed on people list, person detail, and team roster/detail in the same organization. | Denied only for cross-org access. | Organization scope. | Person/roster context has no first-class visibility layer. | Organization admins see the broadest person and roster context. |
| Program director | Allowed on people list for the whole organization and on person detail for any person in the org. | Denied on team detail when `canReadTeamScopedContent` cannot verify program scope from the team page call site. | No scope gate on people list/person detail; intended program scope on team detail is not fully wired. | Access is route based, not per-record visibility based. | Current people list is broader than expected, and current team detail can over-deny program directors because it omits `teamProgramId` in the scope helper call. |
| Coach | Allowed on people list for the whole organization, on person detail for any person in the org, and on matching team detail/roster views. | Denied on team detail outside assigned teams. | No scope gate on people list/person detail; matching team scope on team detail. | Access is route based, not per-record visibility based. | Current people list/person detail are broader than team-scoped coach expectations. |
| Assistant coach | Same as coach for current people/roster reads. | Same as coach for team detail. | No scope gate on people list/person detail; matching team scope on team detail. | Access is route based, not per-record visibility based. | Current person visibility is broader than team-scoped intent. |
| Athlete | Allowed on people list today because the page has no staff gate. | Denied on person detail and team detail. | No effective scope check on people list. | No self-only person directory policy exists. | This is a current implementation gap: authenticated non-staff can browse the people directory. |
| Linked guardian | Allowed on people list today because the page has no staff gate. | Denied on person detail and team detail. | No effective scope check on people list. | No guardian directory policy exists. | Guardian relationship columns are hidden, but the base people directory still loads. |
| Unrelated guardian | Allowed on people list today because the page has no staff gate. | Denied on person detail and team detail. | No effective scope check on people list. | No guardian directory policy exists. | Same people-list exposure as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to `/people` and `/teams` routes. |

### 6. Guardian relationship context

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed to view guardian relationship diagnostics on people/team/person surfaces; allowed to edit where current UI supports editing. | Denied only for cross-org access. | Staff role in same org. | Guardian relationship context is treated as staff-only diagnostics, not guardian-facing data. | Current edit capability is still limited to supported UI paths. |
| Program director | Allowed to view diagnostics; allowed to edit where current UI supports editing. | Denied only for cross-org access. | Any staff role in same org for view; program director role also permits edit flag. | Same staff-only diagnostic assumption. | Diagnostics are not narrowed by per-athlete relationship ownership. |
| Coach | Allowed to view diagnostics; allowed to edit where current UI supports editing. | Denied only for cross-org access. | Any staff role in same org for view; coach role also permits edit flag. | Same staff-only diagnostic assumption. | Staff status, not guardian linkage, controls access. |
| Assistant coach | Allowed to view diagnostics. | Denied from edit-capable flows. | Any staff role in same org for view. | Same staff-only diagnostic assumption. | Assistants can inspect but not edit linkage where edit support exists. |
| Athlete | Denied. | Denied because guardian relationship diagnostics are staff-only. | No supported scope. | No athlete-facing guardian relationship view exists. | This remains an internal staff diagnostic feature. |
| Linked guardian | Denied. | Denied because guardian relationship diagnostics are staff-only. | No supported scope. | No guardian self-service relationship view exists. | Guardian linkage itself does not grant diagnostic visibility. |
| Unrelated guardian | Denied. | Denied because guardian relationship diagnostics are staff-only. | No supported scope. | No guardian self-service relationship view exists. | Same denial as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to people/team/person surfaces. |

### 7. Dashboard / review summaries

| Actor | Expected access | Expected denial | Scope required | Visibility assumptions | Edge cases / current notes |
|---|---|---|---|---|---|
| Organization admin | Allowed across current dashboard/review summaries in the same organization. | Denied only for cross-org access. | Organization scope. | Dashboard panels rely on scoped queries plus supported note/task visibility assumptions. | Org admins see full organization-wide aggregates. |
| Program director | Allowed for events/notes/tasks panels within assigned program scope. | Denied when scope assignments are ambiguous or insufficient for safe scoped queries. | Matching program scope on event/note/task panels. | Note/task panels exclude unsupported/unresolved visibility states. | Some top-level counts (`programs`, `teams`, `people`) and guardian-gap/team-gap reviews remain organization-wide, which is broader than the scoped panels. |
| Coach | Allowed for events/notes/tasks panels within assigned team scope. | Denied when scope assignments are ambiguous or insufficient for safe scoped queries. | Matching team scope on event/note/task panels. | Note/task panels exclude unsupported/unresolved visibility states. | Some top-level counts and broader review slices remain organization-wide even for team-scoped staff. |
| Assistant coach | Same as coach for dashboard reads. | Same as coach for dashboard reads. | Matching team scope on event/note/task panels. | Note/task panels exclude unsupported/unresolved visibility states. | Dashboard remains staff-only, but not every aggregate is fully narrowed to staff scope. |
| Athlete | Denied. | Denied because dashboard/review summaries are staff-only. | No supported scope. | No athlete dashboard is implemented. | No parent/guardian/athlete review summary runtime exists. |
| Linked guardian | Denied. | Denied because dashboard/review summaries are staff-only. | No supported scope. | No guardian dashboard is implemented. | Guardian-linked visibility remains deferred. |
| Unrelated guardian | Denied. | Denied because dashboard/review summaries are staff-only. | No supported scope. | No guardian dashboard is implemented. | Same denial as linked guardian. |
| Unauthenticated user | Denied before page execution. | Denied by Clerk middleware on dashboard routes. | None. | Not applicable. | Applies to `/dashboard` and review-linked surfaces. |

---

## Manual validation checklist

See `./PHASE_9K_VALIDATION_CHECKLIST.md`.

No focused automated tests were added in Phase 9K because the repository currently has no established unit/integration test file pattern to extend for this matrix coverage.

---

## Current implementation gaps found during matrix creation

1. **People list is not staff-gated.**
   - `/people` loads all organization people for any authenticated user, including linked guardians, unrelated guardians, athletes, and even unresolved person-link accounts.
   - Guardian-specific columns are hidden for non-staff, but the base person directory is still exposed.

2. **People detail is staff-only, but not scope-limited.**
   - `/people/[personId]` requires staff access, but any staff member can open any person in the organization regardless of team/program scope.
   - This also broadens person-linked operational history visibility, including attendance/note/task context.

3. **Team detail under-denies some program directors.**
   - `/teams/[teamId]` calls `canReadTeamScopedContent(actorRoleContext, team.id)` without passing `team.program.id`.
   - Program-scoped access therefore falls into the helper's safe deny path (`DENY_PROGRAM_SCOPE_TEAM_UNVERIFIED`) even when the team belongs to the director's program.

4. **Task detail remains more permissive than task list for non-staff ownership edge cases.**
   - `/tasks` is staff-only.
   - `/tasks/[taskId]` still allows linked non-staff assignee/creator access if such a task exists.
   - Current runtime does not intentionally create guardian/athlete-owned tasks, but the behavior is already present.

5. **Dashboard summary scope is only partially narrowed.**
   - Event/note/task panels use scoped filters.
   - Some top-line counts and review slices (`programs`, `teams`, `people`, and guardian/team operational gap panels) remain organization-wide for non-org-scope staff.

6. **Attendance still lacks an explicit read-visibility policy.**
   - Attendance reads follow the containing staff workflow rather than a dedicated attendance visibility rule.
   - There is still no explicit self-view/guardian-view/partial-disclosure policy for attendance reasons and statuses.

7. **Guardian-linked read behavior is still deferred rather than positively enforced.**
   - Guardian access is prevented mainly because guardian-facing read routes do not exist yet.
   - The future boundary still needs explicit guardian-linked record evaluation before any parent/guardian runtime is added.

---

## Blocking Before Entry Runtime

The following unresolved items should be treated as blockers before any Entry runtime implementation:

1. **Close the people-directory exposure gap.**
   - Decide whether `/people` is staff-only or needs a narrower self/relationship-based policy.
   - Enforce that choice before any Entry-era person-linked visibility expands.

2. **Add scope-aware person detail authorization.**
   - Person-linked review/history surfaces need the same team/program narrowing discipline already applied to notes/tasks/events/dashboard.

3. **Fix program-scoped team detail evaluation.**
   - Team detail must pass resolved program context into team-scope evaluation so safe-deny logic does not block legitimate program directors.

4. **Align task detail with intended non-staff policy.**
   - Either explicitly support non-staff assignee/creator reads end-to-end or remove the direct-detail allowance until that workflow is intentionally designed.

5. **Define explicit attendance visibility rules.**
   - Before Entry or guardian-facing runtime, decide who can see attendance status, reason codes, and person-linked attendance summaries.

6. **Eliminate organization-wide dashboard leakage for scoped staff.**
   - All aggregate and review panels must either be truly scoped or explicitly marked/admin-only before mixed-visibility Entry records exist.

7. **Implement positive guardian-boundary enforcement before guardian-facing runtime.**
   - Guardian relationship linkage, consent/disclosure rules, and per-record visibility checks must exist before any guardian-visible Entry, feed, inbox, journal, or portal behavior is introduced.

---

## Validation conclusions

- The matrix matches the currently implemented 9D–9J runtime behavior.
- No Entry runtime behavior was added in Phase 9K.
- No Feed/Inbox/Journal runtime behavior was added in Phase 9K.
- No messaging/notification runtime behavior was added in Phase 9K.
- No runtime code was touched, so no typecheck/build validation was required for this phase.
