# Phase 5A — MVP Pilot Test Plan and Acceptance Criteria

## 1. MVP Pilot Goal

Prove that one real organization can run core team operations end-to-end in CadreOS using:

- Authentication (Clerk sign-in / sign-out)
- UserAccount → Person linking
- Role assignments and scope
- Programs, Seasons, Teams
- Rosters
- Events
- RSVP
- Attendance
- Notes
- Tasks
- Dashboard

A single scripted one-day pilot scenario with real (or role-playing) users is the primary validation vehicle. The pilot is considered a success when all MVP exit criteria defined in section 9 are met.

---

## 2. Test User Roles

| Role | Description |
|---|---|
| **Organization Admin** | Full write access across the organization. Creates programs, seasons, teams, people, roles. |
| **Program Director** | Write access scoped to an assigned program: seasons, teams, rosters, events, notes, tasks. |
| **Coach** | Write access scoped to an assigned team: roster adds, events, RSVP, attendance, notes, tasks. |
| **Assistant Coach** | Limited write access scoped to an assigned team: attendance, notes, tasks only. |
| **Parent/Guardian** | No staff write access. Person record exists. UserAccount optionally linked. |
| **Athlete** | No staff write access. Person record exists. UserAccount optionally linked. |
| **Unlinked signed-in user** | Authenticated via Clerk but has no linked Person record. Denied all write actions. |
| **Signed-out user** | Not authenticated. No access to any protected route. |

---

## 3. Authentication Acceptance Tests

### 3.1 Public Landing Page

| # | Test | Expected Result |
|---|---|---|
| A-01 | Visit `/` while signed out | Landing page renders without error. No protected data is visible. |
| A-02 | Visit `/` while signed in | Landing page renders. Navigation reflects authenticated state. |

### 3.2 Protected Dashboard Routes

| # | Test | Expected Result |
|---|---|---|
| A-03 | Visit `/dashboard` while signed out | Redirected to sign-in page. |
| A-04 | Visit `/people` while signed out | Redirected to sign-in page. |
| A-05 | Visit `/events` while signed out | Redirected to sign-in page. |
| A-06 | Visit `/dashboard` while signed in with linked person | Dashboard loads and shows operational summary. |

### 3.3 Sign-In

| # | Test | Expected Result |
|---|---|---|
| A-07 | Click sign-in link and submit valid credentials | User is authenticated and redirected to `/dashboard`. |
| A-08 | Submit incorrect credentials | Clerk returns an error. No session is created. |

### 3.4 Sign-Out

| # | Test | Expected Result |
|---|---|---|
| A-09 | Click sign-out while on `/dashboard` | Session is cleared. User is redirected to `/` or sign-in page. |
| A-10 | After sign-out, attempt to visit `/dashboard` directly | Redirected to sign-in page. |

### 3.5 Account Page

| # | Test | Expected Result |
|---|---|---|
| A-11 | Visit `/account` while signed in | Account page renders with current Clerk user info. |
| A-12 | Visit `/account` while signed out | Redirected to sign-in page. |

### 3.6 Account / Person Linking

| # | Test | Expected Result |
|---|---|---|
| A-13 | Visit `/account/link-person` while signed in with unlinked account | Link-person form renders. |
| A-14 | Submit valid Person selection on link-person form | UserAccount is linked to selected Person. Confirmation shown. |
| A-15 | Revisit `/account/link-person` after linking | Current linked Person is displayed. |

### 3.7 Unlinked User Behavior

| # | Test | Expected Result |
|---|---|---|
| A-16 | Sign in with a Clerk account that has no linked Person, attempt write action | Denied. User is directed to `/account/link-person`. |
| A-17 | Sign in with a Clerk account that has no linked Person, visit read-only dashboard | Dashboard renders (or redirects) without exposing write actions. |

---

## 4. Authorization Acceptance Tests

### 4.1 Organization Admin — Full Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-01 | Admin creates a Person record | Record created successfully. |
| Z-02 | Admin creates a Program | Program created and visible in program list. |
| Z-03 | Admin creates a Season under a Program | Season created. |
| Z-04 | Admin creates a Team | Team created. |
| Z-05 | Admin assigns a Role to a Person | RoleAssignment created. |
| Z-06 | Admin adds a Roster Member | RosterMembership created. |
| Z-07 | Admin creates an Event | Event created. |
| Z-08 | Admin records Attendance | Attendance record saved. |
| Z-09 | Admin creates a Note | Note created with `STAFF_ONLY` visibility. |
| Z-10 | Admin creates a Task | Task created. |

### 4.2 Program Director — Scoped Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-11 | Program Director creates a Season within their assigned Program | Season created. |
| Z-12 | Program Director creates a Team within their assigned Program | Team created. |
| Z-13 | Program Director adds a Roster Member | RosterMembership created. |
| Z-14 | Program Director creates an Event within scope | Event created. |
| Z-15 | Program Director records Attendance | Attendance record saved. |
| Z-16 | Program Director creates a Note | Note created. |
| Z-17 | Program Director attempts write outside their Program scope | Denied with permission error. |

### 4.3 Coach — Scoped Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-18 | Coach adds a Roster Member to their assigned Team | RosterMembership created. |
| Z-19 | Coach creates an Event for their assigned Team | Event created. |
| Z-20 | Coach submits RSVP for an event participant | RSVP record saved. |
| Z-21 | Coach records Attendance | Attendance record saved. |
| Z-22 | Coach creates a Note | Note created. |
| Z-23 | Coach creates a Task | Task created. |
| Z-24 | Coach attempts to create a Program | Denied with permission error. |
| Z-25 | Coach attempts write for a Team they are not assigned to | Denied with permission error. |

### 4.4 Assistant Coach — Limited Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-26 | Assistant Coach records Attendance for their assigned Team | Attendance record saved. |
| Z-27 | Assistant Coach creates a Note | Note created. |
| Z-28 | Assistant Coach creates a Task | Task created. |
| Z-29 | Assistant Coach attempts to create an Event | Denied with permission error. |
| Z-30 | Assistant Coach attempts to add a Roster Member | Denied with permission error. |

### 4.5 Parent/Guardian — No Staff Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-31 | Parent/Guardian attempts to create a Note (staff action) | Denied with permission error. |
| Z-32 | Parent/Guardian attempts to record Attendance | Denied with permission error. |
| Z-33 | Parent/Guardian attempts to create a Task | Denied with permission error. |
| Z-34 | Parent/Guardian attempts to create an Event | Denied with permission error. |

### 4.6 Athlete — No Staff Write Access

| # | Test | Expected Result |
|---|---|---|
| Z-35 | Athlete attempts to create a Note (staff action) | Denied with permission error. |
| Z-36 | Athlete attempts to record Attendance | Denied with permission error. |
| Z-37 | Athlete attempts to create a Team | Denied with permission error. |

### 4.7 Unlinked User — Denied All Writes

| # | Test | Expected Result |
|---|---|---|
| Z-38 | Unlinked signed-in user attempts any write action | Denied. Redirected to `/account/link-person`. |
| Z-39 | Unlinked signed-in user submits a create-person form | Denied with message indicating account is not linked. |

---

## 5. Core Workflow Acceptance Tests

### 5.1 Person

| # | Test | Expected Result |
|---|---|---|
| W-01 | Admin navigates to People, creates a new Person with all required fields | Person record created and appears in people list. |
| W-02 | Admin edits an existing Person's name and saves | Updated name is reflected immediately in list and detail views. |

### 5.2 Program

| # | Test | Expected Result |
|---|---|---|
| W-03 | Admin creates a Program with name and description | Program created and visible in programs list. |
| W-04 | Admin edits a Program's description | Updated description is reflected in program detail. |

### 5.3 Season

| # | Test | Expected Result |
|---|---|---|
| W-05 | Admin or Program Director creates a Season under a Program with valid dates | Season created and linked to Program. |
| W-06 | Admin edits a Season's end date | Updated date is saved correctly. |

### 5.4 Team

| # | Test | Expected Result |
|---|---|---|
| W-07 | Admin or Program Director creates a Team with name and sport | Team created and visible in teams list. |

### 5.5 Role Assignment

| # | Test | Expected Result |
|---|---|---|
| W-08 | Admin assigns a `COACH` role to a Person with Team scope | RoleAssignment record created. Person appears in team staff list. |
| W-09 | Admin assigns a `PROGRAM_DIRECTOR` role with Program scope | RoleAssignment created. |
| W-10 | Admin removes a role assignment | RoleAssignment deleted. Person loses that role's write access. |

### 5.6 Roster Member

| # | Test | Expected Result |
|---|---|---|
| W-11 | Coach adds an Athlete Person to a Team-Season roster | RosterMembership created. Athlete appears in roster list. |
| W-12 | Coach views the roster for their Team | All rostered athletes are listed. |

### 5.7 Event

| # | Test | Expected Result |
|---|---|---|
| W-13 | Coach creates an Event with title, date/time, and location | Event created and appears in event list. |
| W-14 | Coach edits an Event's location | Updated location is reflected in event detail. |

### 5.8 RSVP

| # | Test | Expected Result |
|---|---|---|
| W-15 | Staff submits RSVP for a participant on an event | RSVP record created or updated. RSVP status is visible in event detail. |
| W-16 | Staff changes RSVP from `YES` to `NO` | RSVP record is updated. Previous status is replaced. |

### 5.9 Attendance

| # | Test | Expected Result |
|---|---|---|
| W-17 | Coach records `PRESENT` attendance for each participant on an event | Attendance records created. Attendance summary reflects counts. |
| W-18 | Coach marks a participant as `ABSENT` with a reason | Attendance record saved with reason field populated. |
| W-19 | Coach updates a previously recorded attendance status | Record is updated, not duplicated. |

### 5.10 Note

| # | Test | Expected Result |
|---|---|---|
| W-20 | Coach creates a Note linked to a Person with body text | Note created with `STAFF_ONLY` visibility default. Visible to staff in note list. |
| W-21 | Coach edits the body of an existing Note | Updated body is saved. |
| W-22 | Parent/Guardian-linked user cannot see `STAFF_ONLY` notes | Notes do not appear in guardian-accessible views. |

### 5.11 Task

| # | Test | Expected Result |
|---|---|---|
| W-23 | Coach creates a Task with title, assignee, and due date | Task created and appears in task list. |
| W-24 | Admin edits a Task's due date | Updated due date is reflected in task detail. |
| W-25 | Staff marks a Task as complete | Task status changes to complete. |

### 5.12 Dashboard

| # | Test | Expected Result |
|---|---|---|
| W-26 | Admin visits `/dashboard` after pilot data is entered | Dashboard shows upcoming events, recent notes, open tasks, and attendance summary. |
| W-27 | Coach visits `/dashboard` | Dashboard shows data scoped to their assigned team(s). |

---

## 6. Negative Test Cases

| # | Test | Expected Result |
|---|---|---|
| N-01 | Create Person with missing required fields (e.g., no first name) | Form validation error shown. Record not created. |
| N-02 | Create Event with invalid date/time (end before start) | Validation error shown. Event not created. |
| N-03 | Add roster member who is already on the same Team-Season roster | Conflict error returned. Duplicate RosterMembership not created. |
| N-04 | Coach attempts write outside their assigned team scope | Server-side permission denied. Error message shown. |
| N-05 | Unlinked signed-in user attempts any write action | Denied. User directed to `/account/link-person`. |
| N-06 | Parent/Guardian attempts to create a staff Note | Denied with permission error. Note not created. |
| N-07 | Signed-out user visits `/dashboard` directly | Redirected to sign-in page. No data exposed. |
| N-08 | Athlete attempts to record Attendance | Denied with permission error. |
| N-09 | Create Season with end date before start date | Validation error shown. Season not created. |
| N-10 | Create Task with no assignee and no title | Validation error shown. Task not created. |

---

## 7. One-Day Pilot Scenario

This scripted path exercises every core workflow in sequence. All steps are performed by real (or role-playing) users using the deployed CadreOS application.

### Step 1 — Setup Organization

- Confirm organization record exists in the database.
- Admin signs in via Clerk and links their account to the org's Admin Person record.
- Admin visits `/dashboard` and confirms it loads without errors.

### Step 2 — Setup Program, Season, and Team

- Admin creates a Program (e.g., "Youth Soccer 2026").
- Admin creates a Season under that Program (e.g., "Spring 2026", with valid start/end dates).
- Admin creates a Team (e.g., "U12 Blue").

### Step 3 — Add People

- Admin creates Person records for:
  - 1 Program Director
  - 1 Coach
  - 1 Assistant Coach
  - 4–6 Athletes
  - 2 Parent/Guardian persons (linked to athletes conceptually)

### Step 4 — Assign Roles

- Admin assigns `PROGRAM_DIRECTOR` role to the Program Director Person, scoped to the Program.
- Admin assigns `COACH` role to the Coach Person, scoped to the Team.
- Admin assigns `ASSISTANT_COACH` role to the Assistant Coach Person, scoped to the Team.

### Step 5 — Roster Athletes

- Coach (or Admin) adds each Athlete Person to the Team-Season roster.
- Confirm each athlete appears in the roster list.

### Step 6 — Create Event

- Coach creates an Event (e.g., "Practice #1", with date/time and location).
- Confirm the event appears in the event list and on the dashboard.

### Step 7 — Capture RSVP

- Staff submits RSVP for each rostered athlete on the event.
- Confirm RSVP statuses are visible in event detail.

### Step 8 — Record Attendance

- Coach records attendance for each participant (a mix of `PRESENT`, `ABSENT`, and optional reasons).
- Confirm attendance summary counts are correct in event detail.

### Step 9 — Create Notes

- Coach creates at least 2 Notes linked to individual athletes, with body text.
- Confirm notes appear in the note list with `STAFF_ONLY` visibility.
- Confirm notes do not appear in any guardian-accessible view (if applicable in this environment).

### Step 10 — Create Tasks

- Coach creates at least 2 Tasks with title, assignee, and due date.
- Mark one Task as complete.
- Confirm open and completed tasks reflect correctly in the task list.

### Step 11 — Review Dashboard

- Admin and Coach each visit `/dashboard`.
- Confirm the dashboard shows:
  - Upcoming event(s)
  - Recent note(s)
  - Open task(s)
  - Attendance summary for the most recent event

---

## 8. Feedback Capture Categories

Pilot testers record feedback using the following categories. Each item includes a category, a short title, and a description.

| Category | When to Use |
|---|---|
| **Bug** | Something is broken, throws an error, or produces wrong data. |
| **Friction** | The workflow works but feels slow, unclear, or awkward. |
| **Missing Feature** | A needed capability is absent and blocks real use. |
| **Workflow Confusion** | It is unclear what the user should do next or what the outcome was. |
| **Decision Needed** | A product or design decision must be made before proceeding. |
| **Follow-up Task** | A known item that should be addressed in a future phase. |
| **Nice-to-Have** | A suggestion that would improve the experience but is not blocking. |

---

## 9. MVP Exit Criteria

CadreOS is MVP-pilot ready when **all** of the following are true:

1. All critical authentication tests (A-01 through A-17) pass without error.
2. All Organization Admin core workflow tests (W-01 through W-27) pass.
3. Role-based write access behaves as specified in the Phase 4E permission matrix for all tested roles (Z-01 through Z-39).
4. Unlinked and unauthorized users fail safely: write attempts are denied, no data is exposed, and users receive actionable guidance (Z-38, Z-39, N-04 through N-07).
5. Negative test cases (N-01 through N-10) are handled with appropriate validation errors; no unhandled server exceptions occur.
6. The dashboard (W-26, W-27) provides a useful operational summary after the pilot scenario is complete.
7. No critical Vercel runtime errors (5xx responses) appear during the one-day pilot scenario execution.

---

## 10. Deferred Items

The following are explicitly out of scope for Phase 5A and the MVP pilot:

| Item | Notes |
|---|---|
| **FieldOps** | Pre-checks, resource booking, and conflict detection. Deferred to a later module. |
| **GearOps** | Inventory, equipment tracking, and compliance. Deferred to a later module. |
| **Notes / Inbox / Entry refactor** | Unified Entry model with Inbox routing. Deferred to a dedicated phase. |
| **Parent/Guardian portal** | Relationship-scoped read access for guardians. `AthleteGuardianRelationship` enforcement deferred. |
| **Full read authorization** | Phase 4E covers write authorization only. Read-page enforcement is a future pass. |
| **Messaging** | Chat, threaded communication, notification delivery. Not part of MVP. |
| **Inventory** | Equipment and supply management. Deferred. |
| **AI / Analytics** | Automated insights, recommendations, and reporting dashboards. Future phase. |

---

## Output Summary

### Files Changed

| File | Action |
|---|---|
| `planning/PHASE_5A_MVP_PILOT_TEST_PLAN.md` | Created |
| `planning/README.md` | Updated — Phase 5A entry added |

### Test Groups Created

| Group | Tests |
|---|---|
| Authentication | A-01 – A-17 |
| Authorization | Z-01 – Z-39 |
| Core Workflows | W-01 – W-27 |
| Negative Cases | N-01 – N-10 |

### MVP Exit Criteria

1. All critical auth tests pass.
2. All admin core workflow tests pass.
3. Role-based write access behaves as specified.
4. Unlinked / unauthorized users fail safely.
5. Negative cases handled without unhandled exceptions.
6. Dashboard provides useful operational summary.
7. No critical Vercel runtime errors during pilot scenario.

### Recommended Next Phase

**Phase 5B — Pilot Execution and Bug Triage**

Run the one-day pilot scenario with real or role-playing users. Capture feedback using the defined categories. Triage results into:
- Blocking bugs requiring hotfixes before broader rollout.
- High-priority friction items to address in a polish pass.
- Deferred items confirmed for later phases.
