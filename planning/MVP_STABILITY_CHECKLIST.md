# CadreOS MVP Stability Checklist

This checklist covers the operational integrity, navigation continuity, workflow consistency, and data relationship integrity of the current CadreOS MVP. It is intended for use during operational reviews, pre-deployment checks, and post-phase validation.

---

## 1. Organization Scoping

- [ ] All Prisma queries include `organizationId: scope.organizationId` as a filter.
- [ ] `getOrganizationScope()` is called at the top of every page and route handler before accessing the database.
- [ ] Pages with `!scope.databaseReady` return a safe amber error state without database access.
- [ ] Pages with `!scope.organizationId` return a safe "no organization context" state without database access.
- [ ] Guardian relationship access (`resolveGuardianRelationshipAccess`) is checked before exposing guardian diagnostic data to the client.
- [ ] No cross-organization data leakage: IDs in URL params are always validated against `organizationId` in the query.

---

## 2. Navigation Continuity

- [ ] Every detail page (`/notes/[noteId]`, `/tasks/[taskId]`, `/events/[eventId]`, `/teams/[teamId]`, `/people/[personId]`) includes a `BackLink` component pointing to the parent list.
- [ ] Edit pages return to the parent detail page on save/cancel.
- [ ] Create pages return to the parent list or the created record on success.
- [ ] Filtered list views (`/notes`, `/tasks`, `/events`) preserve filter state when using operational review quick-links.
- [ ] Filter clear links (`/notes`, `/tasks`, `/events`) return to the unfiltered view.
- [ ] `#operational-history` anchor links in related-history panels correctly navigate to the `OperationalHistoryPanel` on the target page.

---

## 3. Workflow Consistency

### Notes (ObservationNote)
- [ ] New notes default author to the linked `UserAccount.personId`, falling back to `ORGANIZATION_ADMIN` role, then first org person.
- [ ] Notes list shows filtered empty state with "Clear filters" action when active filters return no results.
- [ ] Notes list shows "No context" badge for context-free notes (no athlete, no team, no event).
- [ ] Note detail page shows "Context-free note" indicator in operational status when all context fields are absent.
- [ ] Note detail shows "Follow-up pending" badge when unresolved tasks are linked.
- [ ] Note visibility badge is consistently styled (amber) across list and detail views.

### Tasks (FollowUpTask)
- [ ] New tasks default `createdByPersonId` and `assigneePersonId` to the linked `UserAccount.personId`, with the same fallback chain as notes.
- [ ] Tasks list filtered empty state uses `EmptyState` component with "Clear filters" action (consistent with notes and events pages).
- [ ] Tasks list shows `isUnresolvedTaskStatus` (imported from `lib/follow-up-tasks`) consistently for OPEN, IN_PROGRESS, and BLOCKED statuses.
- [ ] Task detail shows "Orphaned workflow state" badge for BLOCKED tasks with no source note, event, or inbox item.
- [ ] Overdue tasks are highlighted in red in both list and detail views.
- [ ] "Why this task exists" operational reason is always shown in task detail, describing source context or standalone origin.
- [ ] BLOCKED tasks show the `text-red-700` inline label in addition to the status badge.

### Events and Attendance
- [ ] Events list filtered empty state uses `EmptyState` component with "Clear filters" action.
- [ ] Attendance coverage is derived at query time from the team roster; coverage states are: `complete`, `partial`, `missing`, `captured`, `not_applicable`.
- [ ] Events with no team show "—" in the team column and are flagged "Missing responsible team" when they also have unresolved follow-up.
- [ ] Events with no attendance captured after they have passed show `missing` coverage badge.
- [ ] Attendance workflow link is present in both note detail (linked event) and task detail (linked source event).
- [ ] Past events are sorted most-recent-first; upcoming events are sorted earliest-first in the events list.

### Dashboard
- [ ] Dashboard shows counts for: overdue tasks, blocked tasks, stale unresolved tasks, tasks missing responsible context, events needing attendance review, athletes missing guardian linkage (staff only).
- [ ] All dashboard review panels link to filtered list views that preserve the relevant filter state.
- [ ] "Upcoming events" panel links to event detail pages.
- [ ] Operational history panels show the last 8 items by default; full history is accessible via the list views.

---

## 4. Dashboard Integrity

- [ ] Dashboard counts match what the filtered list views return (spot-check stale/overdue/blocked).
- [ ] `OperationalHistoryPanel` on team/person/event detail pages retrieves the most recently changed items within the configured window.
- [ ] Dashboard `ReviewFocusPanel` stats all link to the correct filtered views.
- [ ] Stats with `tone: "danger"` or `tone: "warning"` are non-zero and represent real operational issues, not false positives.

---

## 5. Note / Task / Event Relationship Integrity

- [ ] FollowUpTasks linked to an ObservationNote via `sourceNoteId` show the note excerpt in task detail.
- [ ] FollowUpTasks linked to an Event via `sourceEventId` show the event link in task detail.
- [ ] ObservationNotes linked to an Event via `eventId` show the event link and attendance workflow link in note detail.
- [ ] ObservationNotes linked to an Athlete via `athletePersonId` show the person link in note detail.
- [ ] Deletion of a source note does not currently cascade-delete linked tasks (this is an MVP-known limitation — no orphan cleanup automation exists).
- [ ] Tasks with `sourceNoteId` that have a note with a linked athlete correctly surface guardian context in the task list and detail.
- [ ] Context-free notes (no athlete/team/event) are visually distinguishable in the notes list via the "No context" badge.
- [ ] Orphaned workflow states (BLOCKED task, no source) are visually distinguishable in the task detail via the "Orphaned workflow state" badge.

---

## 6. Guardian Relationship Integrity

- [ ] `resolveGuardianRelationshipAccess` is called before any guardian context is shown, and returns `canViewGuardianRelationshipDetails: false` for non-staff users.
- [ ] Guardian context indicators (`formatGuardianOperationalIndicator`) are consistent across: notes list, notes detail, tasks list, tasks detail, team detail, person detail.
- [ ] `hasNoGuardianOnFile` is shown as "No guardian on file" (not a blank or null).
- [ ] `hasIncompleteRelationshipSupport` (missing UserAccount linkage) is shown as "Guardian relationship incomplete."
- [ ] `hasInactiveGuardianAccountSignal` is shown as "Inactive guardian account signal."
- [ ] AthleteGuardianRelationship queries always include `organizationId` scoping.

---

## 7. Known MVP Limitations (Acknowledged)

These are known limitations that do not require action in the current MVP phase:

- [ ] **Context-free notes**: Notes with no athlete, team, or event are valid but have reduced operational traceability. The "No context" badge makes these visible without blocking creation.
- [ ] **Orphaned workflow states**: BLOCKED tasks with no source context can occur. The "Orphaned workflow state" badge makes these visible; no automated resolution exists.
- [ ] **Stale time windows**: All stale/recent thresholds are fixed constants defined per-page. Not user-configurable.
- [ ] **Attendance roster snapshot**: Expected attendance is derived from the live roster at query time, not the roster at the time of the event.
- [ ] **Task updater not tracked**: `updatedAt` is the only staleness proxy. A dedicated `lastUpdatedByPersonId` is deferred.
- [ ] **Feed/Journal/Entry not implemented**: All `ObservationNote` records; unified Entry model is deferred.
- [ ] **Guardian-accessible views not implemented**: Guardian authorization for notes/tasks is deferred to a post-MVP phase.
- [ ] **No notification or reminder infrastructure**: All follow-up is manual review only.

---

## 8. FieldOps Stability (Do Not Modify)

- [ ] FieldOps booking, conflict, and approval workflows (phases 6A–6K) are stable and must not be changed during Phase 8x operational hardening.
- [ ] `lib/field-ops-booking-precheck.ts` and `app/(dashboard)/field-ops/` routes are excluded from Phase 8O and later operational reviews.

---

*Last updated: Phase 8O — Operational Edge-Case Hardening and Workflow Stability Review*
