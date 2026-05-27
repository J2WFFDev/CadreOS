# Arc 22F — Entry Views Manual QA Checklist

Use this checklist to validate operational Entry views before Arc 22G (Entry Closeout).

Tested against: `main` branch, Arc 22F changes applied.

## Legend

- ✅ Pass
- ❌ Fail — describe symptom and ticket/note
- ⏭  Skip — note reason (e.g. feature not yet deployed)
- N/A — not applicable for this role/environment

---

## Environment Setup

- [ ] Local dev server running (`npm run dev`)
- [ ] Seed data loaded (manual seed — see `package.json` seed command)
- [ ] At least one Person record exists and is linked to a UserAccount
- [ ] At least one Entry exists with each status (OPEN, IN_PROGRESS, DONE, CANCELLED)
- [ ] At least one Entry exists with each type (TASK, FOLLOW_UP, NOTE, DECISION, OBSERVATION)
- [ ] At least one Entry has a due date of today
- [ ] At least one Entry has a due date in the future (next 7 days)
- [ ] At least one Entry has a due date in the past (overdue)
- [ ] At least one Entry is assigned to the test user
- [ ] At least one Entry is assigned to a different user

---

## 1. Inbox (`/entries/inbox`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Inbox items are shown (if seed data present)
- [ ] Empty state message shown when no inbox items
- [ ] Loading state does not flash indefinitely
- [ ] Entries display title, type badge, status badge
- [ ] Routing an entry removes it from the inbox
- [ ] Users with NONE access see an authorization error, not a blank page

---

## 2. Feed (`/feed`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Inbox lane shows unprocessed entries
- [ ] Assigned lane shows entries assigned to the current user
- [ ] Today & Overdue lane shows entries due today or overdue
- [ ] Upcoming lane shows entries due in the next 14 days
- [ ] Recent Activity section shows recent `EntryActivity` events
- [ ] Empty state shown for each lane when no items
- [ ] Inaccessible linked records shown with placeholder, not raw data
- [ ] Feed does not expose entries the current user should not see

---

## 3. Today (`/today`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Entries due today are shown (TASK, FOLLOW_UP, READINESS_ITEM)
- [ ] Overdue entries are also shown
- [ ] Status column shows badge
- [ ] Due date column shows formatted date
- [ ] Assignee column shows full name
- [ ] "Quick Complete" marks entry as DONE and removes it from active view
- [ ] Entries with status DONE/CANCELLED/ARCHIVED do not appear
- [ ] Empty state message shown when no active today/overdue entries
- [ ] Mobile layout is usable (no horizontal overflow on 375px viewport)

---

## 4. Upcoming (`/upcoming`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Entries due in the next 14 days are shown
- [ ] Entries due today or overdue are NOT shown (those belong in Today)
- [ ] Status column shows badge
- [ ] Due date column shows formatted date
- [ ] Assignee column shows full name
- [ ] Entries with status DONE/CANCELLED/ARCHIVED do not appear
- [ ] Empty state message shown when no upcoming entries
- [ ] Mobile layout is usable (no horizontal overflow on 375px viewport)

---

## 5. Assigned to Me (`/assigned`)

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Shows only entries assigned to the current user
- [ ] Entries show title, type badge, status badge, due date, assignee
- [ ] "Quick Complete" marks entry as DONE and removes it from the list
- [ ] Entries with status DONE/CANCELLED/ARCHIVED do not appear
- [ ] Empty state message shown when no assigned active entries
- [ ] Empty state message shown when user account is not linked to a Person
- [ ] Users with NONE access see an authorization error
- [ ] Assignee column shows the current user's name
- [ ] Mobile layout is usable

---

## 6. All Entries (`/entries`)

### 6a. Base view

- [ ] Page loads without error for ORGANIZATION_ADMIN
- [ ] Entries table shows title, type, status, priority, due date, assignee
- [ ] Overdue due dates highlighted in red
- [ ] "Assigned to me" action link in page header navigates to `/assigned`
- [ ] Clicking an entry title opens the entry detail page

### 6b. Type filter

- [ ] Filter by type TASK shows only TASK entries
- [ ] Filter by type NOTE shows only NOTE entries
- [ ] Filter by type FOLLOW_UP shows only FOLLOW_UP entries
- [ ] Filter by type DECISION shows only DECISION entries
- [ ] Unknown/invalid type values in URL are silently ignored

### 6c. Status filter

- [ ] Filter by status OPEN shows only OPEN entries
- [ ] Filter by status IN_PROGRESS shows only IN_PROGRESS entries
- [ ] Filter by status DONE shows only DONE entries
- [ ] Unknown/invalid status values in URL are silently ignored

### 6d. Priority filter

- [ ] Filter by priority HIGH shows only HIGH priority entries
- [ ] Filter by priority URGENT shows only URGENT priority entries
- [ ] Unknown/invalid priority values in URL are silently ignored

### 6e. Assignee filter

- [ ] Filter `assigneePersonId=me` shows only entries assigned to the current user
- [ ] Filter by specific person ID shows only that person's assigned entries
- [ ] Empty assigneePersonId is treated as no filter

### 6f. Due window filter

- [ ] `dueWindow=today` shows only today's entries
- [ ] `dueWindow=upcoming` shows entries due in the next 14 days
- [ ] `dueWindow=overdue` shows entries with past due dates
- [ ] `dueWindow=no_date` shows entries with no due date
- [ ] `dueWindow=all` (default) shows all entries regardless of due date
- [ ] Unknown dueWindow values fall back to `all`

### 6g. Sort order

- [ ] `sort=updated_desc` (default) shows most recently updated first
- [ ] `sort=due_asc` shows entries sorted by nearest due date first
- [ ] `sort=created_desc` shows newest created entries first
- [ ] `sort=priority_desc` shows highest priority entries first

### 6h. Combined filters

- [ ] Combining type + status filters returns only entries matching both
- [ ] Active filter count badge shows correct count when filters applied
- [ ] "Clear filters" link removes all filters and resets to defaults
- [ ] URL params are preserved on page reload

---

## 7. Entry Creation and View Verification

- [ ] Create a TASK entry (no due date) — appears in All Entries, not in Today or Upcoming
- [ ] Create a TASK entry with today's due date — appears in Today view
- [ ] Create a TASK entry with future due date (within 14 days) — appears in Upcoming view
- [ ] Create a FOLLOW_UP and assign it to the current user — appears in Assigned to Me
- [ ] Create a FOLLOW_UP and assign it to another user — does NOT appear in Assigned to Me
- [ ] Complete a FOLLOW_UP assigned to current user — removed from Assigned to Me active list
- [ ] Create a TASK with past due date — appears in Today view as overdue

---

## 8. Role-Aware Visibility

### 8a. Admin/staff

- [ ] ORGANIZATION_ADMIN can view all entry views
- [ ] PROGRAM_DIRECTOR can view all entry views
- [ ] COACH can view all entry views (within current scope)

### 8b. Guardian

- [ ] Guardian-only user (no staff role) sees authorization error on `/entries`
- [ ] Guardian-only user sees authorization error on `/assigned`
- [ ] Guardian-only user sees authorization error on `/today`
- [ ] Guardian-only user sees authorization error on `/upcoming`
- [ ] Guardian-only user cannot determine entry count through error messages or filter results

### 8c. Coach scope

- [ ] Coach sees active entries in the organisation (current behaviour — unrestricted)
- [ ] Coach restriction to own teams is noted as deferred; no test needed yet

### 8d. Data leakage

- [ ] A user cannot see entries from other organisations
- [ ] Filtering by another user's personId does not expose restricted entries
- [ ] Inactive/archived member entries do not appear in active views unless explicitly filtered

---

## 9. Activity Feed Consistency

- [ ] Creating an Entry generates an `EntryActivity` CREATED event visible in Feed
- [ ] Assigning a follow-up generates an activity event visible in Feed
- [ ] Completing a follow-up generates an UPDATED/COMPLETED event visible in Feed
- [ ] Completed/archived entries leave the Today, Upcoming, and Assigned active views
- [ ] Feed is not excessively noisy (no duplicate events for same action)

---

## 10. Mobile Usability

- [ ] All views are usable at 375px viewport width (iPhone SE)
- [ ] Filter panel on `/entries` is accessible and usable on mobile
- [ ] Tables scroll horizontally rather than overflowing outside the viewport
- [ ] Action buttons are sufficiently large to tap (≥ 44px touch target)
- [ ] Nav sidebar collapses correctly on mobile

---

## Notes / Issues Found

| # | View | Description | Status |
|---|------|-------------|--------|
|   |      |             |        |

---

## Sign-off

Tested by: _______________  
Date: _______________  
Arc version: Arc 22F  
Next arc: Arc 22G — Entry Closeout, Auth Audit, QA, Seed Data, and Documentation
