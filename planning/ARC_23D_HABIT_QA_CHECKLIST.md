# Arc 23D — Habit Manual QA Checklist

**Arc:** Arc 23D — Habit Model, Recurrence, and Completion Tracking  
**Status:** Ready for QA  
**Scope:** Habit creation, assignment, cadence, completion, history, role visibility

---

## Prerequisites

- Dev or staging environment running with Arc 23D migration deployed.
- At least one test org with ORGANIZATION_ADMIN, COACH, ATHLETE, and PARENT_GUARDIAN accounts.
- A linked `AthleteGuardianRelationship` record for the guardian test user.

---

## 1. Create Habit

- [ ] Navigate to `/habits/create`
- [ ] Fill in title (required), description (optional)
- [ ] Select an athlete from the athlete dropdown
- [ ] Optionally select a team
- [ ] Select a frequency (Daily / Weekly / Custom)
- [ ] Submit — habit appears in `/habits` list with status badge "Active"
- [ ] Attempt to submit with blank title — form validation blocks submission

---

## 2. Edit Habit

- [ ] Open an active habit detail page → click Edit
- [ ] Modify title and description — save — changes appear on detail page
- [ ] Modify frequency — save — new cadence appears in detail page
- [ ] Edit with empty title — validation blocks submission
- [ ] Editing an ARCHIVED habit: the Edit button is not shown (or edit route redirects/rejects)

---

## 3. Assign Habit to Athlete

- [ ] Admin creates habit and selects a specific athlete → habit shows correct athlete name on detail page
- [ ] Athlete sees the habit in their active habits list
- [ ] Another unrelated athlete does NOT see the habit in their list

---

## 4. Assign Habit to Team (optional team field)

- [ ] Admin creates habit and selects a team → habit shows team context on detail page
- [ ] Coach for that team can see the habit in the habits list
- [ ] Coach for a different team does NOT see the habit in their list

---

## 5. Set Recurrence / Cadence

- [ ] Create habit with Daily frequency — detail shows "Daily"
- [ ] Create habit with Weekly frequency — detail shows "Weekly" (and days if entered)
- [ ] Create habit with Custom frequency — detail shows "Custom"
- [ ] Edit habit and change frequency from Daily to Weekly — detail reflects new frequency

---

## 6. Mark Habit Complete (Check-in)

- [ ] Athlete opens their active habit detail page
- [ ] Submits check-in for today (optionally adds note) — completion row appears in history
- [ ] Page shows updated streak and completion count
- [ ] Check-in form is NOT shown for PAUSED habits
- [ ] Check-in form is NOT shown for ARCHIVED habits
- [ ] Non-assigned athlete cannot check in to another athlete's habit (route returns 403)

---

## 7. Duplicate Completion Prevention (Same Date)

- [ ] Athlete submits check-in for today
- [ ] Immediately submits another check-in for today
- [ ] Second submission redirects to detail page with `?duplicate=1` query param
- [ ] Page shows a "Already checked in today" message (or equivalent)
- [ ] Only ONE completion row appears in history for today

---

## 8. View Completion History

- [ ] Detail page shows a table of past check-ins with date column
- [ ] Admin and athlete can see the "Note" column in the history table
- [ ] Coach sees the history table WITHOUT the Note column
- [ ] Guardian sees the history table WITHOUT the Note column

---

## 9. Streak and Completion Count

- [ ] After a single check-in: streak = 1, count = 1
- [ ] After consecutive daily check-ins on 3 days: streak = 3, count = 3
- [ ] After skipping a day: streak resets to the number of consecutive days from the most recent run (not the total count)
- [ ] Weekly streak counts consecutive calendar weeks, not individual days
- [ ] Custom frequency shows completion count (no streak shown or streak = total count)

---

## 10. Pause and Resume Habit

- [ ] Admin/creator opens active habit — clicks Pause → status badge changes to "Paused"
- [ ] Paused habit: check-in form is hidden on detail page
- [ ] Paused habit appears in Paused filter tab in list
- [ ] Paused habit does NOT appear in Active tab
- [ ] Click Resume on paused habit → status returns to "Active"
- [ ] Check-in form is visible again after resuming

---

## 11. Archive Habit

- [ ] Admin/creator opens active or paused habit — clicks Archive → status badge changes to "Archived"
- [ ] Archived habit does NOT appear in Active, Paused, or "All Active" tabs
- [ ] Archived habit appears in Archived filter tab
- [ ] Check-in and Edit actions are NOT available for archived habits
- [ ] Habit completion history is preserved after archiving
- [ ] Archive is NOT reversible through the UI (deferred to future arc)

---

## 12. Active Habits View

- [ ] `/habits` defaults to "Active" tab showing only ACTIVE habits
- [ ] Filter tabs switch between Active / Paused / Archived / All views
- [ ] Athlete sees only their own habits in the active view
- [ ] Admin sees all habits across the org
- [ ] Empty state message displays when no habits exist in a filtered view

---

## 13. Guardian Visibility Policy

- [ ] Guardian logs in — navigates to `/habits`
- [ ] Guardian sees habits for their linked athlete only
- [ ] Guardian can see habit title, status badge, completion count, and streak
- [ ] Guardian does NOT see the Note column in completion history
- [ ] Guardian does NOT see habits for athletes they are not linked to
- [ ] Attempt to access `/habits/[id]` for an unlinked athlete's habit — redirected or 403

---

## 14. Coach Visibility Scope

- [ ] Coach logs in — sees habits for athletes in their team
- [ ] Coach does NOT see habits for athletes outside their assigned teams/programs
- [ ] Coach cannot edit, archive, or pause a habit they did not create
- [ ] Coach does NOT see the Note column in completion history

---

## 15. Activity and Feed Sanitization

- [ ] Habit creation event: any activity/feed entry shows only safe label (e.g. "Habit created") — no athlete name, no title content, no note content
- [ ] Habit check-in event: feed label shows "Habit check-in recorded" — no note text
- [ ] Guardian viewing feed: no private athlete habit data surfaced
- [ ] Verify no habit completion note text appears in feed payloads

---

## 16. Existing Feature Regression

- [ ] Journal list, create, and submit flows are unaffected
- [ ] Prompt library and prompt assignment are unaffected
- [ ] Tasks list and create/edit flows are unaffected
- [ ] Notes list and create flows are unaffected
- [ ] Events list and attendance flows are unaffected
- [ ] GearOps, FieldOps, and MemberOps dashboards load without errors
- [ ] Dashboard home page loads without errors

---

## Known Deferred Behaviors

- **Reminders:** No push/email/SMS reminders. Deferred to future arc.
- **Bulk assignment:** Assigning a habit to all team members at once. Deferred.
- **Habit templates:** Reusable habit definitions. Deferred.
- **Advanced recurrence (RRULE):** Skip dates, exception dates. Deferred.
- **Coach review workflow:** Structured coach review of athlete habit progress. Deferred.
- **Arc 23E:** Guardian-safe feed integration, EntryActivity emission for habit events.
