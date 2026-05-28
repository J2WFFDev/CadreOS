# Arc 23G — Journals & Habits Views, Filters, and Readiness UX QA Checklist

Use this checklist to validate Arc 23G operational surfaces and privacy-safe behavior.

---

## Athlete Experience

- [ ] Athlete can view assigned prompts at `/prompt-assignments`.
- [ ] Athlete can identify open vs completed assignments from status and readiness badges.
- [ ] Athlete can identify overdue and due-soon assignments.
- [ ] Athlete can open prompt response flow from authorized assignments.
- [ ] Athlete can view active habits at `/habits`.
- [ ] Athlete can use habit filters (status, cadence, team if scoped, athlete/self).
- [ ] Athlete can view journal status and source badges at `/journals`.
- [ ] Athlete can filter journals by status/source and confirm expected rows.

---

## Guardian Experience (Relationship-Scoped)

- [ ] Linked guardian can view summary-safe data for linked athlete(s).
- [ ] Guardian can view prompt assignment state where policy allows.
- [ ] Guardian cannot access unrelated athlete assignment/journal/habit data.
- [ ] Guardian sees no journal body text in broad operational lists, summaries, or badges.
- [ ] Guardian prompt assignment rows do not expose prompt-library management paths.

---

## Coach / Staff / Admin Operational Views

- [ ] Staff can filter prompt assignments by athlete, team, and program.
- [ ] Staff can filter journal operational lists by athlete/team/program/source/status.
- [ ] Staff can filter habit operational lists by athlete/team/program/cadence/status.
- [ ] Coaches only see scoped operational records (team/program relationship scoped).
- [ ] Admin/staff can use status and readiness indicators to identify at-risk work quickly.

---

## Overdue / Readiness Indicators

- [ ] Overdue prompt assignments are marked clearly.
- [ ] Due-soon prompt assignments are marked clearly.
- [ ] Closed/completed prompt assignments are marked clearly.
- [ ] Habit readiness labels render expected state (`On track`, `Needs first check-in`, `Paused`, `Archived`).
- [ ] Journal status badges match workflow state (`Draft`, `Submitted`, `Archived`).

---

## Filters and Privacy

- [ ] Journal filters do not reveal unauthorized records through counts or options.
- [ ] Habit filters do not reveal unauthorized records through counts or options.
- [ ] Prompt assignment filters do not reveal unauthorized records through counts or options.
- [ ] Archived records only appear when intentionally filtered for archived/all states.
- [ ] Filter combinations return stable, role-safe results with no private-content leakage.

---

## Dashboard / Feed / Cross-Surface Safety

- [ ] Feed remains safe-summary-only for journal/habit-related activity labels.
- [ ] No journal body text appears in dashboard, feed, or broad operational widgets.
- [ ] No unauthorized athlete details appear through cross-surface links or metadata.

---

## Mobile and Usability

- [ ] Journal, habit, and prompt assignment list views remain usable on narrow/mobile widths.
- [ ] Status/readiness badges remain legible on mobile.
- [ ] Filter controls remain usable on mobile and tablet breakpoints.
- [ ] Navigation to Journals, Prompt Assignments, Habits, and Guardian Summary is discoverable.

---

## Regression and Safety

- [ ] Existing Entry, MemberOps, GearOps, ResourceOps, tasks, notes, and feed pages still render.
- [ ] Existing authorization checks still block direct URL access to unauthorized detail records.
- [ ] No Communications delivery (email/SMS/push) behavior was introduced.
- [ ] No destructive schema migration or broad schema rewrite was introduced.

---

## Sign-off

| Checker | Date | Notes |
|---|---|---|
|  |  |  |
