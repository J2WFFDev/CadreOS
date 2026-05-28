# Arc 23I — Manual QA Checklist

## Purpose

This checklist covers all major Entry-derived systems and operational surfaces.
Use it to verify that CadreOS behaves as one integrated operational platform.

Each section should be verified by an operator with appropriate role context.

---

## Setup

Before running the checklist:
- [ ] Log in as a **Coach/Staff** user
- [ ] Log in as an **Athlete** user in a separate session
- [ ] Log in as a **Guardian** user linked to the Athlete in a third session (optional)
- [ ] Confirm test organization has seed data populated (`npm run db:seed`)

---

## 1. Entry Creation Patterns

### Notes
- [ ] Create a Note from the Notes list page — form renders, saves, redirects
- [ ] Note appears in Notes list with correct status badge
- [ ] Note does NOT appear in Athlete's own view (staff-only visibility)

### Tasks
- [ ] Create a Task with no assignee — appears in list as Open
- [ ] Create a Task assigned to an Athlete — appears in Athlete's Assigned-to-me view
- [ ] Task appears in Today view if due date is today
- [ ] Task appears in Upcoming view if due date is in the future

### Decisions
- [ ] Create a Decision entry — form renders, saves, redirects
- [ ] Decision appears in Decisions list with correct status badge
- [ ] Decision detail page loads without error

### Journals
- [ ] Athlete creates a Journal entry (DRAFT) — saves successfully
- [ ] Athlete submits journal — status changes to SUBMITTED
- [ ] Coach can see Athlete's submitted journal
- [ ] Guardian can see submitted journal summary (no body text leakage)
- [ ] Guardian CANNOT see draft journal

### Prompts
- [ ] Staff assigns a Prompt to an Athlete
- [ ] Prompt appears in Athlete's inbox/prompt queue
- [ ] Athlete responds to Prompt — journal entry created
- [ ] Prompt status updates after response

### Habits
- [ ] Create a Habit — form renders, saves, redirects
- [ ] Habit appears in Active tab with green "Active" badge
- [ ] Habit detail page loads without error
- [ ] Record a check-in — completion count increments
- [ ] Streak displays correctly after daily check-in

---

## 2. Status Badge Consistency

- [ ] Active/Open entries show **blue** or **green** badge (not red, not zinc)
- [ ] Done/Completed entries show **green** badge
- [ ] Paused entries show **yellow** badge
- [ ] Archived/Cancelled/Draft entries show **zinc** (grey) badge
- [ ] All badges are readable in dark mode
- [ ] Status badge text matches the status value (e.g., "Active", "Open", "Paused")

---

## 3. Filter Behavior

### Tasks
- [ ] Status filter (All / Open / In Progress / Done / Archived) narrows results correctly
- [ ] Assignee filter narrows results correctly
- [ ] Due window filter (All / Overdue / Upcoming) narrows results correctly
- [ ] Filters can be combined (status + assignee)
- [ ] Clearing all filters returns full list
- [ ] Filter tabs have correct `aria-current="page"` on active tab

### Notes
- [ ] Visibility filter (All / Staff-only / Shared) narrows results correctly

### Habits
- [ ] Status filter (Active / Paused / Archived / All) narrows results correctly
- [ ] Active tab is selected by default

### Journals
- [ ] Workflow status filter (All / Draft / Submitted / Archived) narrows results correctly

---

## 4. Inbox Behavior

- [ ] New unassigned tasks appear in Inbox if status is OPEN
- [ ] Inbox count is non-negative and does not include archived items
- [ ] Inbox does NOT show items the current user is not authorized to see
- [ ] Athletes see only their own inbox items
- [ ] Staff/Coach see org-scoped inbox items
- [ ] Inbox is empty state message shown when list is empty

---

## 5. Feed Behavior

- [ ] Feed shows recent activity across Entry types
- [ ] Feed entries use consistent operational labels (not raw enum values)
- [ ] Journal body text does NOT appear in feed
- [ ] Habit check-in text is safe (no sensitive note content leaked)
- [ ] Feed is scoped by role (Athlete sees own feed, Coach sees team feed)
- [ ] Archived entries do not generate new feed events
- [ ] Feed is empty state when no recent activity

---

## 6. Today / Upcoming Behavior

- [ ] Today view shows items due today (tasks, follow-ups, check-ins)
- [ ] Upcoming view shows items due in the next 7+ days
- [ ] Items without a due date do NOT appear in Today or Upcoming
- [ ] Overdue items appear in Today (or a dedicated overdue section)
- [ ] Athlete sees only their own items in Today/Upcoming
- [ ] Coach/Staff see team-scoped items

---

## 7. Assigned-to-Me Behavior

- [ ] Tasks assigned to me appear in Assigned-to-me
- [ ] Follow-ups assigned to me appear in Assigned-to-me
- [ ] Prompts assigned to me appear in Assigned-to-me
- [ ] Completed items do NOT appear in Assigned-to-me by default
- [ ] Archived items do NOT appear in Assigned-to-me
- [ ] Assigned-to-me is empty state when no items are assigned

---

## 8. Archive / Completion Patterns

- [ ] Archiving a task removes it from Active and Today views
- [ ] Archiving a habit moves it to the Archived tab
- [ ] Completing a task moves it to Done status
- [ ] Completed tasks no longer appear in Assigned-to-me by default
- [ ] Archived entries still accessible via detail URL
- [ ] Archive action is only available to authorized roles

---

## 9. Mobile Layout

- [ ] Notes list readable on 375px viewport
- [ ] Tasks list readable on 375px viewport — no horizontal overflow
- [ ] Feed readable on 375px viewport
- [ ] Habit detail page readable on 375px viewport
- [ ] All filter tab strips wrap correctly (no overflow) on mobile
- [ ] Status badges are not cut off on mobile

---

## 10. Role-Aware Visibility

### Athlete
- [ ] Can see own journals, habits, tasks, prompts
- [ ] Cannot see other athletes' journals
- [ ] Cannot see staff-only notes
- [ ] Cannot access /decisions, /notes from another athlete's session

### Guardian
- [ ] Can see linked Athlete's submitted journals (summary view)
- [ ] Cannot see linked Athlete's draft journals
- [ ] Cannot see linked Athlete's private notes
- [ ] Cannot access any other athlete's data

### Coach/Staff
- [ ] Can see all team members' entries within their team scope
- [ ] Can see athlete journals (submitted)
- [ ] Can assign tasks, prompts, habits to athletes
- [ ] Cannot access data outside org scope

### Admin
- [ ] Can access all org-scope data
- [ ] Guardian diagnostics visible (staff-gated diagnostic page)
- [ ] Decision records accessible

---

## 11. Protected Data Leakage Prevention

- [ ] Journal body text does not appear in activity feed
- [ ] Journal body text does not appear in API responses for unauthorized users
- [ ] Habit check-in notes do not appear in feed
- [ ] Note body does not appear for non-staff users
- [ ] Error states do not expose DB or internal identifiers
- [ ] URL manipulation to another org's IDs returns 404 or access denied
- [ ] Direct URL access to `/decisions`, `/journals`, `/habits` without auth redirects to sign-in

---

## 12. Dashboard Cards

- [ ] Today count card shows correct count
- [ ] Assigned-to-me count card shows correct count
- [ ] Inbox count card shows correct count
- [ ] Counts are zero when no matching items, not negative or N/A
- [ ] Counts update after creating/completing an item (after page refresh)
- [ ] Dashboard cards visible to Coach/Staff
- [ ] Dashboard cards scoped correctly for Athlete role
