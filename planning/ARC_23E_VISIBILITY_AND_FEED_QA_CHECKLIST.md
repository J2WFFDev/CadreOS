# Arc 23E — Visibility and Feed Manual QA Checklist

> Arc 23E: Guardian-Safe Visibility and Feed Integration

Use this checklist for manual QA before marking Arc 23E fully validated. Each item lists the role performing the action and the expected safe outcome.

---

## Journal Submission and Feed Safety

- [ ] **Athlete submits a journal entry**
  - Navigate to `/journals/new`, write body text, submit
  - Expected: entry status changes to `DONE`
  - Check: feed at `/feed` shows "Journal submitted" (or prompt-specific label) — **no body text visible**
  - Check: activity metadata in the feed card does not contain journal content

- [ ] **Journal prompt assigned to athlete**
  - Staff assigns a prompt to an athlete
  - Expected: feed shows "Journal prompt assigned" — no prompt body or athlete-private content

- [ ] **Athlete completes a prompt-assigned journal**
  - Athlete responds to a prompt assignment and submits
  - Expected: feed shows "Journal prompt completed" — no response text visible

- [ ] **Feed does not show journal body text in any card or excerpt**
  - Browse `/feed` as any role
  - Expected: all journal-related cards show only safe summary labels, never `content` field

---

## Guardian Visibility

- [ ] **Guardian views linked athlete summary**
  - Sign in as a guardian with a linked athlete relationship
  - Navigate to `/guardian-summary`
  - Expected: sees athlete's submitted journal count, habit summary — **no journal body text**
  - Expected: habit completion note is not visible

- [ ] **Unrelated guardian cannot view athlete summary or detail**
  - Sign in as a guardian with **no linked athlete**
  - Navigate to `/guardian-summary`
  - Expected: empty state ("No linked athletes") — no athlete names, counts, or journal titles leaked

- [ ] **Guardian cannot access another athlete's journal detail directly**
  - As guardian, attempt to navigate directly to `/journals/[unlinked-athlete-entry-id]`
  - Expected: 403 or redirect — no journal content displayed

- [ ] **Guardian cannot see draft journals**
  - Athlete has a journal in draft (OPEN/STAFF_ONLY) state
  - Expected: draft does not appear in guardian summary or guardian-accessible views

- [ ] **Guardian cannot infer private content through counts or metadata**
  - Athlete has private STAFF_ONLY journals
  - Expected: guardian summary count reflects only visible (ORGANIZATION_SCOPED + submitted) entries
  - Expected: STAFF_ONLY entry count is not surfaced to guardian

---

## Coach Visibility

- [ ] **Coach views scoped athlete journal status**
  - Sign in as a coach with team/program assignment
  - Navigate to relevant athlete journal/habit view
  - Expected: sees only athletes within allowed team/program scope

- [ ] **Coach cannot view out-of-scope athlete records**
  - Sign in as a coach without assignment to a team
  - Attempt to navigate to another team's athlete journal
  - Expected: 403 or empty — no journal titles or content visible

- [ ] **Coach sees habit completion summary for scoped athlete**
  - Navigate to habit view for an athlete in coach's scope
  - Expected: sees completion count and streak — completion `note` gated by role

- [ ] **Coach cannot see habit completion notes for out-of-scope athlete**
  - Navigate to completion detail for an athlete outside coach's scope
  - Expected: note field not rendered or access denied

---

## Staff and Admin Access

- [ ] **Staff can view journal entries for review**
  - Sign in as staff
  - Navigate to journal detail for any organization athlete
  - Expected: full detail accessible, role attribution is logged/visible

- [ ] **Staff cannot see journals from a different organization**
  - Expected: org-scoped query returns only intra-org records

---

## Dashboard and Widget Safety

- [ ] **Dashboard does not show journal body text**
  - Sign in as any role, navigate to `/dashboard`
  - Expected: no journal body text in any widget, summary card, or activity panel

- [ ] **Dashboard counts do not reveal unauthorized records**
  - As guardian, check any journal/habit count widget
  - Expected: count matches only visible records (no inflation from STAFF_ONLY)

---

## Activity Metadata Safety

- [ ] **Activity metadata does not include private journal content**
  - Inspect the feed's activity payload (browser DevTools → Network → feed API response)
  - Expected: activity `title` field contains only safe label ("Journal submitted", "Journal prompt assigned", etc.)
  - Expected: no `content`, `body`, `note`, or raw journal text in any metadata field

- [ ] **Prompt-specific activity labels are correct**
  - Assign a prompt, complete the response, cancel an assignment
  - Check feed for each action
  - Expected labels:
    - After assign: "Journal prompt assigned"
    - After response submitted: "Journal prompt completed"
    - After cancellation: "Prompt assignment cancelled"

- [ ] **Habit activity labels are correct**
  - Assign and complete a habit
  - Check feed
  - Expected labels: "Habit assigned", "Habit completed"

---

## Direct URL Authorization

- [ ] **Direct URL to unauthorized journal detail is blocked**
  - As guardian (unlinked), attempt: `/journals/[other-athlete-entry-id]`
  - Expected: 403 or redirect to unauthorized page

- [ ] **Direct URL to unauthorized habit detail is blocked**
  - As guardian (unlinked), attempt: `/habits/[other-athlete-habit-id]`
  - Expected: 403 or redirect

- [ ] **Direct URL to archived journal returns safe state**
  - Athlete archives a journal
  - Guardian navigates to that journal's URL
  - Expected: if linked athlete → safe summary with `[Archived]` label; if unlinked → 403

---

## Habit Visibility

- [ ] **Habit assigned to athlete appears in athlete's habit list**
  - Assign a habit to an athlete, navigate to habit list as athlete
  - Expected: habit appears with correct recurrence and next due date

- [ ] **Habit completion is visible to athlete, not to unlinked guardian**
  - Athlete completes a habit
  - Sign in as unlinked guardian, navigate to habit views
  - Expected: no completion records visible

- [ ] **Habit archived is hidden from active views**
  - Archive a habit
  - Navigate to active habit list
  - Expected: archived habit not in default list; only visible with explicit archived filter

---

## Regression Checks

- [ ] **Existing Entry/Journal/Habit/MemberOps/Feeds not broken**
  - Run `npm test` — expect 718 passing, 1 pre-existing failure (`buildGearImportTemplateCsv`)
  - Navigate `/feed`, `/journals`, `/habits`, `/tasks`, `/dashboard`, `/people` as various roles
  - Expected: all pages render without errors

- [ ] **Linked object panels do not leak protected journal/habit details**
  - Navigate to an Entry linked to a journal
  - Expected: linked journal panel shows title/status only — no body text, no private notes

---

## Completion Sign-off

| Checker | Date | Notes |
|---------|------|-------|
| | | |
