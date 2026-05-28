# Arc 22G — Entry Manual QA Checklist

Complete manual QA checklist for the Entry domain closeout.

Covers admin/staff, coach, guardian, and negative-access scenarios across all Entry views and workflows.

Tested against: `main` branch, Arc 22A–22G changes applied.

## Legend

- ✅ Pass
- ❌ Fail — describe symptom and note
- ⏭  Skip — note reason (e.g. not yet deployed)
- N/A — not applicable for this role/environment

---

## Environment Setup

- [ ] Local dev server running (`npm run dev`)
- [ ] Seed data loaded (`npm run seed`)
- [ ] At least one Person record linked to a UserAccount for each role under test
- [ ] Entry seed data from Arc 22G present (see `prisma/seed.mjs` Arc 22G section)

---

## Section 1 — Entry Creation

### 1a. Minimal Entry (admin/staff)

- [ ] Navigate to `/entries/quick-add`
- [ ] Enter title only, submit — entry created with type NOTE, status OPEN, priority MEDIUM
- [ ] Entry appears in `/entries` list immediately
- [ ] Entry does not appear in `/today` or `/upcoming` (no due date)
- [ ] EntryActivity `entry.created` event recorded

### 1b. Note-Style Entry

- [ ] Create entry with type NOTE, title, and content body
- [ ] Entry appears in `/entries` with NOTE type badge
- [ ] Entry detail shows title and content
- [ ] No due date shows "—" in due-date column

### 1c. Task-Style Entry

- [ ] Create entry with type TASK, title, due date today
- [ ] Entry appears in `/today` view
- [ ] Entry appears in `/entries` with TASK type badge
- [ ] EntryActivity `entry.created` event recorded

### 1d. Follow-Up-Style Entry

- [ ] Create entry with type FOLLOW_UP, assign to current user
- [ ] Entry appears in `/assigned` view
- [ ] Entry appears in `/entries` with FOLLOW_UP type badge
- [ ] EntryActivity `entry.assignment_added` event recorded

### 1e. Save to Inbox

- [ ] Create NOTE entry with no due date and no context target (quick capture)
- [ ] InboxRoutingItem created for the entry
- [ ] Entry appears in `/entries/inbox`
- [ ] Entry does NOT appear in `/today` or `/upcoming`

---

## Section 2 — Entry Detail and Editing

- [ ] Click entry title in list — navigates to `/entries/[id]`
- [ ] Detail page shows: title, type, status, priority, due date, created by, assignee
- [ ] Edit link visible for entries the current user can update
- [ ] Update title — reflected immediately on detail page and in list
- [ ] Update status (OPEN → IN_PROGRESS) — reflected in status badge
- [ ] Update due date — reflected in Today/Upcoming views immediately
- [ ] "Complete" action marks entry DONE, sets `completedAt`
- [ ] Completed entry removed from Today/Upcoming/Assigned active views
- [ ] Completed entry still visible in `/entries` list (status DONE)

---

## Section 3 — Entry Linking

### 3a. Link to Person/Athlete

- [ ] On entry detail page, add link to an athlete Person record
- [ ] EntryObjectLink created with `targetType = PERSON`
- [ ] Linked person name displayed on detail page
- [ ] EntryActivity `entry.graph_link_added` recorded

### 3b. Link to Team

- [ ] On entry detail page, add link to a team record
- [ ] EntryObjectLink created with `targetType = TEAM`
- [ ] Linked team name displayed on detail page

### 3c. Link to Event

- [ ] On entry detail page, add link to an event record
- [ ] EntryObjectLink created with `targetType = EVENT`
- [ ] Default relationship type `OBSERVED_DURING` applied

### 3d. Link to ResourceBooking (if supported)

- [ ] On entry detail page, link to a resource booking
- [ ] EntryObjectLink created with `targetType = RESOURCE_BOOKING`
- [ ] Default relationship type `READINESS_FOR` applied

### 3e. Link to GearItem (if supported)

- [ ] On entry detail page, link to a gear item
- [ ] EntryObjectLink created with `targetType = GEAR_ITEM`
- [ ] ⏭ Skip if gear linking not yet surfaced in UI

### 3f. Remove Entry Link

- [ ] Remove an existing EntryObjectLink from the detail page
- [ ] EntryActivity `entry.graph_link_removed` recorded
- [ ] Removed link no longer appears on detail page

---

## Section 4 — Follow-Up / Task Workflow

### 4a. Create Follow-Up from Entry

- [ ] On entry detail page, click "Create follow-up"
- [ ] New FOLLOW_UP entry created with `parentEntryId` pointing to source
- [ ] EntryActivity `entry.follow_up_created` recorded on source entry

### 4b. Assign Follow-Up

- [ ] Assign follow-up to a specific user (self)
- [ ] `assignedToPersonId` set correctly
- [ ] EntryActivity `entry.follow_up_assigned` recorded
- [ ] Follow-up appears in `/assigned` for that user

### 4c. Set Due Date

- [ ] Set due date on follow-up to today
- [ ] Follow-up appears in `/today`
- [ ] Set due date 7 days from now — appears in `/upcoming`

### 4d. Complete Follow-Up

- [ ] Mark follow-up DONE via "Quick Complete"
- [ ] `taskCompleted = true`, `completedAt` set, status = DONE
- [ ] EntryActivity `entry.follow_up_completed` recorded
- [ ] Follow-up removed from `/assigned` active view
- [ ] Follow-up removed from `/today` or `/upcoming` active view

### 4e. Note-to-Task Conversion

- [ ] On a NOTE entry, click "Convert to task"
- [ ] New TASK entry created with `sourceNoteId` pointing to original note
- [ ] Task title derived from note title
- [ ] EntryActivity `entry.note_converted_to_task` recorded

---

## Section 5 — Feed Behavior

- [ ] `/feed` loads without error for ORGANIZATION_ADMIN
- [ ] Inbox lane shows unprocessed entries
- [ ] Assigned lane shows entries assigned to the current user
- [ ] Today & Overdue lane shows entries due today or overdue
- [ ] Upcoming lane shows entries due in next 14 days
- [ ] Recent Activity section shows `EntryActivity` events
- [ ] Empty state shown for each lane when no items match
- [ ] Inaccessible linked records shown with placeholder text (`[Restricted]` or `[Unavailable]`)
- [ ] Feed does not expose entries the current user should not see
- [ ] No duplicate events for the same action

---

## Section 6 — Today View (`/today`)

- [ ] Page loads without error
- [ ] TASK entries with `dueDate = today` appear
- [ ] FOLLOW_UP entries with `dueDate = today` appear
- [ ] Overdue entries (past due date, status OPEN/IN_PROGRESS) appear
- [ ] DONE/CANCELLED/ARCHIVED entries do not appear
- [ ] Status badge shown for each row
- [ ] Due date shown formatted
- [ ] Assignee name shown
- [ ] "Quick Complete" marks entry DONE and removes it from active view
- [ ] Empty state shown when no active today/overdue entries
- [ ] Mobile layout usable at 375px viewport (no horizontal overflow)

---

## Section 7 — Upcoming View (`/upcoming`)

- [ ] Page loads without error
- [ ] Entries due tomorrow through +14 days appear
- [ ] Entries due today or overdue do NOT appear (those are in Today)
- [ ] DONE/CANCELLED/ARCHIVED entries do not appear
- [ ] Status badge shown
- [ ] Due date shown formatted
- [ ] Assignee name shown
- [ ] Empty state shown when no upcoming entries
- [ ] Mobile layout usable at 375px viewport

---

## Section 8 — Assigned to Me (`/assigned`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Shows only entries assigned to the current user
- [ ] Entries show title, type badge, status badge, due date, assignee
- [ ] "Quick Complete" marks entry DONE and removes it from list
- [ ] DONE/CANCELLED/ARCHIVED entries do not appear
- [ ] Empty state shown when no assigned active entries
- [ ] Empty state shown when user account is not linked to a Person (no `actorPersonId`)
- [ ] Mobile layout usable

---

## Section 9 — Inbox (`/entries/inbox`)

- [ ] Page loads without error
- [ ] Items with `status = OPEN` and `subjectRefType = ENTRY` appear
- [ ] Empty state shown when no inbox items
- [ ] Entry title, type, and status displayed
- [ ] Routing an entry (marking inbox item PROCESSED) removes it from inbox list
- [ ] Routed entry still visible in `/entries` list

---

## Section 10 — All Entries (`/entries`)

### 10a. Base view

- [ ] Page loads without error
- [ ] Title, type, status, priority, due date, assignee columns shown
- [ ] Overdue due dates highlighted in red
- [ ] Clicking entry title opens detail page
- [ ] "Assigned to me" link in header navigates to `/assigned`

### 10b. Type filter

- [ ] Filter TASK → only TASK entries
- [ ] Filter NOTE → only NOTE entries
- [ ] Filter FOLLOW_UP → only FOLLOW_UP entries
- [ ] Filter DECISION → only DECISION entries
- [ ] Unknown type value in URL → silently ignored (all entries shown)

### 10c. Status filter

- [ ] Filter OPEN → only OPEN entries
- [ ] Filter IN_PROGRESS → only IN_PROGRESS entries
- [ ] Filter DONE → only DONE entries
- [ ] Unknown status value → silently ignored

### 10d. Priority filter

- [ ] Filter HIGH → only HIGH priority entries
- [ ] Filter URGENT → only URGENT priority entries
- [ ] Unknown priority value → silently ignored

### 10e. Assignee filter

- [ ] `assigneePersonId=me` → only entries assigned to current user
- [ ] Specific person ID → only that person's assigned entries
- [ ] Empty `assigneePersonId` → no filter applied

### 10f. Due window filter

- [ ] `dueWindow=today` → today's entries only
- [ ] `dueWindow=upcoming` → entries in the next 14 days
- [ ] `dueWindow=overdue` → entries with past due dates
- [ ] `dueWindow=no_date` → entries with no due date
- [ ] `dueWindow=all` (default) → all entries
- [ ] Unknown `dueWindow` value → falls back to `all`

### 10g. Sort order

- [ ] `sort=updated_desc` (default) → most recently updated first
- [ ] `sort=due_asc` → nearest due date first
- [ ] `sort=created_desc` → newest created first
- [ ] `sort=priority_desc` → highest priority first

### 10h. Combined filters

- [ ] Type + status combined → only entries matching both
- [ ] Active filter count badge shows correct count when filters applied
- [ ] "Clear filters" link removes all filters and resets to defaults
- [ ] URL params preserved on page reload

---

## Section 11 — Activity Events

- [ ] `entry.created` recorded on entry create
- [ ] `entry.updated` recorded on entry update
- [ ] `entry.status_changed` recorded on status update
- [ ] `entry.linked` / `entry.unlinked` recorded on link add/remove
- [ ] `entry.assignment_added` recorded on assignee set
- [ ] `entry.follow_up_created` recorded on follow-up create
- [ ] `entry.follow_up_assigned` recorded on follow-up assign
- [ ] `entry.follow_up_completed` recorded on follow-up complete
- [ ] `entry.completed` / `entry.archived` recorded on terminal status
- [ ] Events visible in Feed recent activity section
- [ ] No duplicate events for the same action

---

## Section 12 — Role-Aware Visibility

### 12a. Admin / Staff

- [ ] ORGANIZATION_ADMIN can access all Entry views
- [ ] PROGRAM_DIRECTOR can access all Entry views
- [ ] COACH can access all Entry views
- [ ] ASSISTANT_COACH can access all Entry views

### 12b. Guardian (no staff role)

- [ ] Guardian-only user sees authorization error on `/entries`
- [ ] Guardian-only user sees authorization error on `/entries/inbox`
- [ ] Guardian-only user sees authorization error on `/feed`
- [ ] Guardian-only user sees authorization error on `/assigned`
- [ ] Guardian-only user sees authorization error on `/today`
- [ ] Guardian-only user sees authorization error on `/upcoming`
- [ ] Error message does not expose any entry count, ID, title, or type
- [ ] Guardian cannot navigate to `/entries/[id]` for a staff-only entry
- [ ] Error page shows only a generic access-denied message

### 12c. Coach scope

- [ ] Coach sees active entries in the organisation
- [ ] Coach team-scoped restriction noted as deferred (no test required)

### 12d. Cross-organisation data isolation

- [ ] User from Organisation A cannot see entries from Organisation B via URL manipulation
- [ ] Filtering by a person ID from another org returns empty results, not an error
- [ ] Filtering by an entry ID from another org returns 404, not 403 (no leakage)

---

## Section 13 — Negative Access Tests

- [ ] Unauthenticated request to `/entries` returns redirect to sign-in, not a blank page
- [ ] Unauthenticated request to `/entries/[id]` returns redirect to sign-in
- [ ] Invalid entry ID in URL returns 404 with generic message (no entry title/type in error)
- [ ] Deleted entry URL returns 404, not the deleted entry data
- [ ] Assigning an entry to a person from another org is rejected (validation at service layer)
- [ ] Creating an entry without a title is rejected with a clear validation error
- [ ] Passing `assigneePersonId` as a UUID from another org returns empty results, not an error or foreign data

---

## Section 14 — Inactive / Archived Member Context

- [ ] Entry linked to an inactive/archived athlete still appears if the entry is active
- [ ] Archived member's name in assignee column shows current name (not archival state)
- [ ] Archived member context does not appear in active Today/Upcoming/Assigned/Feed views unless the entry itself is active
- [ ] `deletedAt != null` entries are excluded from all active views (soft-delete filter works)

---

## Section 15 — Mobile Usability

- [ ] `/entries` usable at 375px viewport width (iPhone SE)
- [ ] Filter panel accessible and usable on mobile
- [ ] `/feed` usable at 375px (no overflow)
- [ ] `/today` usable at 375px (table scrolls horizontally if needed)
- [ ] `/upcoming` usable at 375px
- [ ] `/assigned` usable at 375px
- [ ] `/entries/inbox` usable at 375px
- [ ] Entry detail page (`/entries/[id]`) usable at 375px
- [ ] Action buttons have ≥ 44px touch target height
- [ ] Nav sidebar collapses correctly on mobile

---

## Section 16 — Regression: Existing Workflows Not Broken

- [ ] Notes (`/notes`) list and create workflows unaffected
- [ ] Tasks (`/tasks`) list and create workflows unaffected
- [ ] Events (`/events`) list, detail, and attendance workflows unaffected
- [ ] MemberOps person/team/roster views unaffected
- [ ] GearOps catalog and assignment workflows unaffected
- [ ] FieldOps booking views unaffected
- [ ] Dashboard (`/dashboard`) summaries unaffected
- [ ] No new Journals/Habits UI present

---

## Notes / Issues Found

| # | Section | View | Description | Status |
|---|---------|------|-------------|--------|
|   |         |      |             |        |

---

## Sign-off

Tested by: _______________  
Date: _______________  
Branch: _______________  
Arc version: Arc 22G  
Next arc: Arc 23 — Journals & Habits
