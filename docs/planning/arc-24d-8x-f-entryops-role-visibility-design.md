# Arc 24D.8X-F - EntryOps Role Visibility Rules

## Current State

### Role Models And Enums

CadreOS has two related role representations:

- Prisma `RoleType`: `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, `ASSISTANT_COACH`, `PARENT_GUARDIAN`, `ATHLETE`.
- UI `AppRole`: `ADMIN`, `PROGRAM_MANAGER`, `COACH`, `ASSISTANT_COACH`, `GUARDIAN`, `ATHLETE`, `LIMITED_VIEWER`.

`RoleAssignment` stores the production role relationship:

- `personId`
- `roleType`
- `scopeType`: `ORGANIZATION`, `PROGRAM`, `TEAM`
- optional `programId`
- optional `teamId`

Navigation and high-level module/action policy live in:

- `lib/auth/access-control.ts`
- `lib/auth/current-user.ts`
- `lib/navigation/cadreos-nav.ts`

EntryOps visible navigation currently includes:

- Inbox
- Lists
- All Work Items
- Habits
- Journal Library

The navigation model is not the same as server-side access control. For example, EntryOps as a group is visible to guardian/athlete app roles, while Inbox/Lists/All Work Items/Journal Library are currently staff-only nav items.

### Guardian/Dependent Relationship Model

Guardian relationships are explicit in `AthleteGuardianRelationship`:

- `athletePersonId`
- `guardianPersonId`
- `relationshipType`: `PARENT` or `GUARDIAN`
- `guardianRole`: `PRIMARY_GUARDIAN`, `SECONDARY_GUARDIAN`, `EMERGENCY_CONTACT`

Guardian-aware helper patterns already exist:

- `lib/habits/access.ts` resolves `linkedGuardianAthleteIds`.
- `lib/journals/access.ts` resolves `linkedGuardianAthleteIds`.
- `app/(dashboard)/guardian-summary/page.tsx` loads only linked athletes and excludes journal body/completion notes.

### Entry Ownership, Assignment, List, And Visibility Behavior

Entry model facts:

- `createdByPersonId` is the author/creator.
- `assignedToPersonId` is a scalar assignee.
- `EntryAssignment` supports multi-assignee ownership/collaborator/reviewer records.
- `teamId` may scope a work item to a team.
- `visibility` has `STAFF_ONLY`, `TEAM_STAFF`, and `ORGANIZATION_SCOPED`.
- `listId` attaches an Entry to an `EntryList`.

Current Entry access helper:

- `lib/operational-entry/authorization.ts`
- `resolveEntryAccess()` returns coarse organization-level levels: `NONE`, `READ`, `WRITE`, `MANAGE`.
- `ORGANIZATION_ADMIN` and organization-scoped `PROGRAM_DIRECTOR` get `MANAGE`.
- Staff roles get `WRITE`.
- `PARENT_GUARDIAN` and `ATHLETE` are self-service roles, but `resolveEntryAccess()` returns `NONE` for them.
- `hasSelfServiceEntryRole()` exists for limited assigned/today views.

Current broad Entry surfaces:

- `/entries` (All Work Items) allows any non-`NONE` `resolveEntryAccess()` actor and then queries organization-wide non-journal entries, with optional type/status/priority/assignee/due filters.
- `/entries/[entryId]` currently enforces only coarse Entry access. It does not yet enforce per-entry creator/assignee/team/guardian/default visibility rules.
- `/entries/inbox` currently reads `InboxRoutingItem` queue rows for the organization, then fetches referenced entries. It does not yet filter by actor/list scope.
- `/lists` calls `fetchListsForActor()`, which returns personal lists for the actor, all organization lists, and all program/team lists.
- `/lists/[listId]` fetches a list by id and then queries entries by `listId` without per-actor list scope filtering.

Entry default list behavior:

- `lib/entries/lists.ts` resolves/creates default Inbox lists.
- Default Inbox scope is team if `teamId` is present, personal if an actor person id is present, otherwise organization.
- New OperationalEntry creation resolves default Inbox when no explicit `listId` is supplied.

Current risk:

- Access control and default filtering are not separated consistently yet.
- Elevated staff can use broad views, but coach/program scope is not consistently enforced in broad Entry/List queries.
- Guardians and athletes have self-service Today/Assigned patterns, but not a general role-filtered EntryOps default model.

### Habit Ownership/Athlete Behavior

Habit model facts:

- `athletePersonId` is the subject/owner athlete.
- `assignedToTeamId` can scope a habit to a team.
- `createdByPersonId` records the creator.
- Habit details, list, check-ins, completions, and activities use real Habit records.

Current Habit access:

- `lib/habits/access.ts`
- Admin/director can read broadly.
- Athlete can read their own habit.
- Coach/assistant coach can read habits for scoped team/program assignment.
- Guardian can read habits for linked athletes, but completion detail is summary-only.
- Check-in is limited to the athlete or admin/director.

Current Habit list behavior:

- `/habits` queries organization habits by status, then filters in memory through `canReadHabit()`.
- No explicit default role filter UI exists yet for guardian family filters, coach "mine/team/person", or admin/program views.

### Journal Prompt, Assignment, And Response Behavior

Journal response model:

- Journal responses are `Entry` rows with `type = JOURNAL`.
- `journalPromptId` and `journalAssignmentId` optionally link responses to prompt library and assignments.
- Journal payload metadata lives in `EntryTypePayload`.

Current journal response access:

- `lib/journals/access.ts`
- Author can read their own journal.
- Admin/director can read broadly.
- Submitted `TEAM_STAFF` journals are readable by scoped coaches.
- Submitted `ORGANIZATION_SCOPED` journals are readable by linked guardians.
- Drafts are visible only to author/admin/director.
- Journal body rendering is guarded in detail: author/admin/final journal can show body, otherwise body is hidden.

Journal prompt library behavior:

- `lib/journals/prompt-access.ts`
- Staff and athletes can read active prompt library.
- Guardians cannot read prompt library.
- Admin/director can manage prompt library.
- Staff can assign prompts.

Prompt assignment behavior:

- Staff currently see all prompt assignments in the organization.
- Athletes see assignments addressed to them or their teams.
- Guardians see assignments for linked athletes.

Current Journal Library navigation:

- Navigation label is "Journal Library" and routes to `/prompts`.
- It is currently staff-only in visible EntryOps navigation, even though `canReadPromptLibrary()` allows athletes.

### All Work Items, Inbox, And List Behavior

All Work Items:

- Current route: `/entries`.
- Current behavior is organization-wide for any actor with coarse Entry read access.
- Current filters: type, status, priority, assignee, due window, sort.
- Current non-journal entry types include legacy/internal Entry enum values except `JOURNAL`.

Inbox:

- Current route: `/entries/inbox`.
- Current behavior uses `InboxRoutingItem`, not only `EntryList.isInbox`.
- Current query is organization-wide open inbox-routing entries.
- Arc 24D.8X-C made Inbox a default `EntryList`, but this route has not yet fully shifted from routing queue semantics to role-filtered Inbox list semantics.

Lists:

- Current route: `/lists`.
- Current helper returns all organization/program/team lists plus actor-owned personal lists.
- Current list detail reads list entries without explicit actor/list scope enforcement.

### Dev Persona Behavior

Dev personas live in `lib/auth/devPersonas.ts` and are exposed through the dashboard layout when enabled:

- Admin
- Program Manager
- Coach
- Assistant Coach
- Guardian
- Athlete
- Limited Viewer

Dev persona `CurrentUser` objects include role-like fields such as `teamIds`, `athleteIds`, and `guardianAthleteIds`, but most server-side data access helpers still resolve against production `Person`, `RoleAssignment`, and `AthleteGuardianRelationship` data through `getOrganizationScope()`.

Design implication:

- Implementation should preserve the dev persona switcher and test personas.
- Server-side filtering should continue to rely on real person/org/role relationships unless an explicit test-fixture bridge is added.

### Permission And Query Helper Locations

Primary helpers and surfaces:

- Entry access: `lib/operational-entry/authorization.ts`
- Entry creation/default list: `lib/operational-entry/service.ts`, `lib/entries/lists.ts`
- Entry filters: `lib/operational-feed/filters.ts`
- Entry feed queries: `lib/operational-feed/queries.ts`
- Habit access: `lib/habits/access.ts`
- Habit query surfaces: `app/(dashboard)/habits/page.tsx`, `app/(dashboard)/habits/[habitId]/page.tsx`
- Journal access: `lib/journals/access.ts`
- Journal prompt/assignment access: `lib/journals/prompt-access.ts`
- Guardian summary: `app/(dashboard)/guardian-summary/page.tsx`
- Navigation: `lib/navigation/cadreos-nav.ts`
- Auth/module actions: `lib/auth/access-control.ts`

## Target Visibility Matrix

### Org Admin

Access allowed:

- All Entries, Habits, Journals, Lists, and All Work Items within the organization.

Default view filter:

- All Work Items may default organization-wide/unfiltered.
- Inbox, Lists, Habits, and Journals may default to current operational context, but must provide explicit broad filters where useful.

Optional filters:

- Organization, program, team, person/assignee, creator, list, status, type, due window, habit athlete/team/status.

Views affected:

- Inbox: may show organization inbox by default, with personal/team/list filters.
- Lists: can see all list scopes.
- All Work Items: org-wide default allowed.
- Habits: org-wide allowed; default active habits.
- Journal Library: all prompt templates and assignments.
- Entry detail: direct URL allowed for all org entries.
- Habit detail: direct URL allowed for all org habits.
- Journal response/detail: direct URL allowed, with existing journal body safeguards where policy requires.

### Program Manager / Program Director

Access allowed:

- Program-scoped work, plus organization-scoped access where current `PROGRAM_DIRECTOR` policy already treats them as admin-like.

Default view filter:

- Prefer program/team context when a program/team scope is known.
- All Work Items can expose program/team/person filters.

Optional filters:

- Program, team, person/assignee, creator, list, status, type, due window, habit athlete/team/status.

Views affected:

- Inbox: default to program/team or own operational inbox when scope is known.
- Lists: show owned personal, organization lists if allowed, and scoped program/team lists.
- All Work Items: show program-scoped default unless explicitly elevated to organization-wide by policy.
- Habits: show scoped program/team/athlete habits.
- Journal Library: can manage/read prompt templates.
- Entry detail: enforce scoped access, not just existence in organization.
- Habit detail: enforce Habit access helper.
- Journal response/detail: enforce Journal access helper.

### Coach

Access allowed:

- Own items by default.
- Team/athlete items through explicit team/person filters when role/team relationships support access.

Default view filter:

- Own assigned/created items, plus direct team context only when the view is clearly scoped.

Optional filters:

- Assigned to me, created by me, team, athlete/person, list, status, type, due window.

Views affected:

- Inbox: default to own/personal Inbox or team Inbox when explicitly selected.
- Lists: personal lists plus team lists for assigned teams.
- All Work Items: default to own items, with team/person filters for scoped team access.
- Habits: default to own-created or team-scoped active habits; explicit athlete/team filters allowed.
- Journal Library: read/assign prompt templates according to current prompt policy.
- Entry detail: direct URL should require creator/assignee/team/list/explicit relationship access.
- Habit detail: already uses Habit access helper; keep this.
- Journal response/detail: already uses Journal access helper; keep this.

### Assistant Coach

Access allowed:

- Same default safety posture as Coach, but preserve any narrower scope policy if future staff-role distinctions are introduced.

Default view filter:

- Own items by default.

Optional filters:

- Assigned to me, created by me, team, athlete/person, list, status, type, due window.

Views affected:

- Same as Coach, with team/person filters only where current role/team relationships support them.

### Guardian

Access allowed:

- Own items.
- Linked dependent-athlete summary/context where explicit guardian relationships allow it.
- No accidental access to unrelated athletes or staff-only work.

Default view filter:

- All Family: own items plus linked dependent athletes.

Required optional filters:

- All Family
- Just Me
- Individual dependent athlete

Views affected:

- Inbox: if exposed later, default to All Family but only own/dependent-safe entries; no staff inbox leakage.
- Lists: own personal lists and dependent-safe family context only if implementation adds family list support.
- All Work Items: should not be a broad org view for guardians. If visible later, it must default to All Family and be explicitly family-filtered.
- Habits: visible for linked athletes; completion detail remains summary-only.
- Journal Library: guardians should not see prompt templates by default.
- Entry detail: direct URL must enforce guardian/dependent access; unrelated entries should 404 or show permission denied.
- Habit detail: already allows linked athlete habits with summary-only completion detail.
- Journal response/detail: already allows linked submitted organization-scoped journals while hiding unsafe body detail when needed.

### Athlete

Access allowed:

- Own items only.
- Own habits.
- Own journal responses and assignments.

Default view filter:

- Just Me.

Optional filters:

- Status, type, due window, list, habit status.

Views affected:

- Inbox: own Inbox only if exposed.
- Lists: personal lists only unless team lists are explicitly approved.
- All Work Items: if visible, only own entries.
- Habits: own habits.
- Journal Library: current prompt policy allows athletes to read prompt library; visible navigation currently hides it. Decide whether that should stay hidden or become assignment-focused.
- Entry detail: direct URL own entries only.
- Habit detail: own habit detail and check-in.
- Journal response/detail: own responses and assignments.

### Other Limited Roles

Access allowed:

- Own items only, or no EntryOps access if no product reason exists.

Default view filter:

- Just Me.

Optional filters:

- Minimal status/type/date filters only if an EntryOps surface is exposed.

Views affected:

- Inbox/List/All Work Items/Habits/Journal Library should remain hidden or limited to own data until an explicit product use case is approved.
- Detail direct URLs should not reveal unrelated entries/habits/journals.

## Key Design Decisions

### All Work Items

Recommendation:

- Treat All Work Items as the intended broad operational view for elevated roles.
- Org Admin may default to organization-wide/unfiltered.
- Program Manager / Program Director should default to program/team scope unless the actor has explicit organization-wide administrative scope.
- Coaches and assistant coaches should default to own items, with explicit team/person filters that only include allowed teams/athletes.
- Guardians/athletes should not get a broad organization-wide All Work Items view.

Implementation implication:

- Add a shared EntryOps visibility/filter helper before changing individual pages.
- Keep access control separate from default filters: the helper should expose both "what may be read" and "what should be shown by default."

### Guardian Default Visibility

Recommendation:

- Guardian default is `All Family`: own items plus linked dependent athletes.
- Guardian filters must include:
  - All Family
  - Just Me
  - Individual dependent athlete
- Guardian views must never include unrelated athletes, staff-only entries, staff Inbox queues, or private journal content.

### Coach Default Visibility

Recommendation:

- Coach default is own items.
- Team/athlete visibility should be available only through explicit filters once the allowed team/person set is resolved from `RoleAssignment`/team membership.
- Do not silently default coaches into all team data until the user chooses a team/athlete scope or the route is explicitly team-scoped.

### Entry Detail Direct URL Enforcement

Recommendation:

- Entry detail direct URL should enforce the same access rules as list/default filtered views, not just coarse organization-level Entry access.
- Direct URL access should evaluate:
  - creator
  - scalar assignee
  - `EntryAssignment`
  - team/program scope
  - list scope
  - guardian/dependent relationship when applicable
  - journal-specific policy for `EntryType.JOURNAL`
- Unauthorized direct URLs should return not found or a permission-safe error without leaking title/body.

### Habit Visibility

Recommendation:

- Habits should continue to follow Habit owner/athlete/team/guardian visibility, not generic Entry visibility.
- Habit-to-EntryOps links should not make HabitCompletion into generated Entry work.
- Habit views may add explicit role filters, but `Habit` remains the source of truth.

### Journal Library And Journal Responses

Recommendation:

- Journal Library is template/prompt visibility.
- Journal responses are Entry-backed and must follow Journal response access, not prompt-library access.
- Athletes may read prompt templates by current policy, but visible navigation currently hides Journal Library from athletes. Keep the visible nav hidden until the product decides whether athletes need a prompt library view separate from assignments/responses.
- Guardians should not see prompt templates by default.

## Implementation Slices

### 24D.8X-G - EntryOps Visibility Helper And All Work Items Defaults

Goal:

- Add shared EntryOps visibility/default-filter helpers and apply them first to All Work Items.

Allowed files/modules:

- `lib/entryops/visibility.ts` or equivalent new helper
- `lib/operational-entry/authorization.ts` if needed for read predicates only
- `app/(dashboard)/entries/page.tsx`
- Targeted tests for role/default filter behavior
- Planning note

Non-goals:

- No schema changes
- No navigation changes
- No Habit or Journal behavior changes
- No broad permission rewrite
- No migration or data cleanup

Validation:

- `npm run typecheck`
- `npm run build`
- targeted visibility/filter tests

Acceptance criteria:

- All Work Items uses a shared default filter.
- Org Admin can default broad.
- Coach defaults to own items.
- Guardian/athlete cannot see organization-wide work through All Work Items.
- Explicit filters are documented and constrained to allowed scopes.

### 24D.8X-H - Inbox And Lists Role-Safe Defaults

Goal:

- Align Inbox and Lists with the EntryList-as-Inbox model and role-safe default visibility.

Allowed files/modules:

- `lib/entries/lists.ts`
- Inbox/List pages and related helpers
- Targeted list/default Inbox tests
- Planning note

Non-goals:

- No schema changes
- No route deletion
- No broad data migration
- No Today/Review redesign
- No Habit/Journal behavior changes

Validation:

- `npm run typecheck`
- `npm run build`
- targeted EntryList/Inbox visibility tests

Acceptance criteria:

- Inbox defaults to the actor-safe Inbox scope.
- Lists page does not expose program/team lists outside actor scope.
- List detail enforces the same list visibility as the list index.
- Legacy `InboxRoutingItem` behavior is either preserved behind safe filters or documented for later removal.

### 24D.8X-I - Guardian/Athlete Family Filters And Detail Enforcement

Goal:

- Add guardian/athlete filter controls and enforce detail URL access consistently across EntryOps detail routes.

Allowed files/modules:

- Entry detail access helper/page
- Guardian/dependent filter helper
- Habit list filters if needed
- Journal response/detail helper integration if needed
- Targeted guardian/athlete detail access tests
- Planning note

Non-goals:

- No schema changes
- No journal body policy relaxation
- No HabitCompletion-to-Entry conversion
- No notification changes
- No relationship redesign

Validation:

- `npm run typecheck`
- `npm run build`
- targeted guardian/athlete visibility tests

Acceptance criteria:

- Guardian filter options are All Family, Just Me, and individual dependent athlete.
- Athlete defaults to Just Me.
- Entry detail direct URLs cannot reveal unrelated entries.
- Habit and Journal detail behavior remains at least as restrictive as current policy.

## Guardrails

- No schema changes unless explicitly approved later.
- No broad permission rewrite in one PR.
- Separate access control from default filters.
- Protect minors/dependent data by default.
- Avoid exposing guardian/athlete/private journal data unintentionally.
- Preserve dev persona testing support.
- Do not treat navigation visibility as authorization.
- Do not treat `Entry.visibility = ORGANIZATION_SCOPED` as guardian-visible unless the domain policy explicitly allows it.
- Do not collapse Habit visibility into generic Entry visibility.
- Do not collapse Journal Library prompt visibility into Journal response visibility.
- Do not make Today/Review/Feed primary navigation again as part of visibility implementation.
