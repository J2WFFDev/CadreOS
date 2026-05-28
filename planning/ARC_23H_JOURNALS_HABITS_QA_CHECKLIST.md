# Arc 23H — Journals & Habits Final QA Checklist

**Arc:** Arc 23H — Journals & Habits Closeout  
**Status:** Final closeout checklist  
**Goal:** Validate Release 1 readiness with privacy-safe, role-aware behavior.

---

## 1) Athlete Scenarios

- [ ] Athlete can create a journal draft (`/journals/create`)
- [ ] Athlete can edit own draft (`/journals/[id]/edit`)
- [ ] Athlete can finalize/submit own draft (`/journals/[id]/submit`)
- [ ] Athlete can archive own journal (`/journals/[id]/archive`)
- [ ] Athlete can create prompted response from active prompt assignment
- [ ] Athlete can create a habit (`/habits/create`)
- [ ] Athlete can check in active assigned habit
- [ ] Athlete cannot check in paused/archived habit

## 2) Guardian Scenarios

- [ ] Guardian sees linked-athlete journal/habit summary only (`/guardian-summary`)
- [ ] Guardian can view linked athlete submitted/archived guardian-visible journal
- [ ] Guardian cannot view journal drafts
- [ ] Guardian cannot view staff-only or team-staff-only journal content
- [ ] Guardian cannot view completion note detail for habits

## 3) Coach Scenarios

- [ ] Coach can access scoped team/program athlete journals where visibility allows
- [ ] Coach cannot read out-of-scope athlete journals
- [ ] Coach can assign prompts
- [ ] Coach can view scoped habits
- [ ] Coach cannot view completion note detail unless elevated role policy allows

## 4) Staff/Admin Scenarios

- [ ] Admin/program director can manage prompt library (create/edit/archive)
- [ ] Admin/program director can access all scoped journals/habits in org
- [ ] Admin can archive journals and habits according to workflow constraints

## 5) Privacy Boundary Tests

- [ ] Journal body content is never exposed in broad feed/dashboard summaries
- [ ] Protected content is not leaked via labels, counts, metadata, filters, or links
- [ ] Direct URL access enforces role/scoped authorization
- [ ] Unrelated guardian cannot infer athlete private journal/habit data

## 6) Dashboard/Feed Privacy Tests

- [ ] Recent activity uses safe journal labels only
- [ ] Habit activity uses safe labels only (no completion note/body leakage)
- [ ] Inbox/Assigned operational lists exclude journal entries
- [ ] Dashboard summary cards avoid rendering private journal body content

## 7) Assignment/Completion Tests

- [ ] Prompt assignment lifecycle: pending/active/completed/cancelled status handling
- [ ] Athlete can respond only to open assignments targeted to self/team
- [ ] Habit check-in duplicate same-day prevention is enforced
- [ ] Habit completion history displays expected date rows

## 8) Habit Recurrence Tests

- [ ] Daily streak logic validates consecutive-day behavior
- [ ] Weekly streak logic validates consecutive-week behavior
- [ ] Custom recurrence uses count-based summary behavior
- [ ] Completion count deduplicates same-day completion dates

## 9) Version/Trust Coverage

- [ ] Journal updates increment Entry version metadata
- [ ] Submitted/archive workflow preserves audit-ready activity trail
- [ ] Role-restricted journal body visibility remains enforced on detail pages

## 10) Mobile Layout Checks

- [ ] Journal list/detail/edit pages are usable on narrow viewport
- [ ] Habit list/detail/check-in pages are usable on narrow viewport
- [ ] Prompt list/detail/assignment pages are usable on narrow viewport
- [ ] Overflow tables remain readable with horizontal scroll where needed

## 11) Negative Access Tests

- [ ] Unauthenticated user cannot access journal/habit protected routes
- [ ] Guardian cannot access unrelated athlete journal/habit detail routes
- [ ] Coach cannot access out-of-scope athlete journal/habit detail routes
- [ ] Athlete cannot edit/archive another athlete’s journal
- [ ] Athlete cannot check in another athlete’s habit

## 12) Regression Guardrails

- [ ] Existing Entry workflows (notes/tasks/follow-ups/feed) remain intact
- [ ] MemberOps and guardian relationship workflows remain intact
- [ ] GearOps and FieldOps routes continue to load without Journal/Habit regressions
- [ ] No Communications/email/SMS/push features were introduced

