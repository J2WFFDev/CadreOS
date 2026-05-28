# Arc 23E — Guardian-Safe Visibility and Feed Integration

## Status: ✅ Complete

---

## Background

Arc 23E hardens guardian-safe visibility and feed integration for the Journals & Habits domain (Arc 23). It builds on the foundational access controls from Arc 23B–23D and closes gaps in activity text sanitization, guardian-scoped summary views, and feed safety.

**Prerequisites completed:**
- Arc 23A: Journals & Habits inventory, privacy model, and gap planning
- Arc 23B: Journal Entry Type and Draft/Final Workflow (`lib/journals/access.ts`, `lib/journals/policy.ts`)
- Arc 23C: Prompt Library and Prompt Assignment (`lib/journals/prompt-access.ts`)
- Arc 23D: Habit Model, Recurrence, and Completion Tracking (`lib/habits/access.ts`, `lib/habits/policy.ts`)

---

## Visibility Policy

### Journal body text

- `Entry.content` is **sensitive by default** and must never appear in:
  - Activity event titles or metadata
  - Feed excerpts or cards
  - Guardian summary views
  - Dashboard widgets
  - API responses to non-owner roles without explicit staff/coach authorization

### Journal visibility by role

| Role | Access |
|------|--------|
| Athlete (owner) | Own drafts (OPEN) and submitted (DONE/ARCHIVED) journals |
| Guardian | Submitted/archived journals for **linked athlete(s) only**, via `AthleteGuardianRelationship`. No draft or STAFF_ONLY content. |
| Coach | Journals within allowed team/program/athlete scope, via `TeamRoleAssignment`. Gated by `EntryVisibility.TEAM_STAFF` or `ORGANIZATION_SCOPED`. |
| Staff/Admin | All journals within the organization, subject to role assignment and documented intent. |
| Unrelated guardian | No access. Zero-record responses (empty list, not 403 leak). |

### Habit visibility by role

| Role | Access |
|------|--------|
| Athlete (owner) | Own habit assignments, schedules, and completions |
| Guardian | Habit summaries (name, count, streak) for linked athletes only. Completion `note` field is excluded. |
| Coach | Habits within allowed scope. `note` field gated by `canReadCompletionDetail`. |
| Staff/Admin | All habits within the organization. |

### Prompt assignment visibility

- Assignment status (assigned, completed, cancelled) may be visible in feeds and summaries.
- Prompted journal **response content** is gated identically to journal body text (never exposed in feeds or guardian summaries).

### Activity event text (safe labels)

All activity events use safe summary labels only. No body text, note content, or private metadata is included:

| Action | Safe label |
|--------|------------|
| Journal draft created | `Journal draft created` |
| Journal submitted | `Journal submitted` |
| Journal archived | `Journal archived` |
| Prompt assigned | `Journal prompt assigned` |
| Prompt response submitted | `Journal prompt completed` |
| Prompt assignment cancelled | `Prompt assignment cancelled` |
| Habit assigned | `Habit assigned` |
| Habit completed | `Habit completed` |
| Habit archived | `Habit archived` |

---

## What Was Done

### 1. Extended `deriveSafeJournalActivityText` (lib/journals/policy.ts)

Added prompt-specific action labels. Previously these fell through to the generic "Journal entry" fallback:

- `journal.prompt_assigned` → `"Journal prompt assigned"`
- `journal.prompt_response_submitted` → `"Journal prompt completed"`
- `journal.prompt_assignment_cancelled` → `"Prompt assignment cancelled"`

### 2. HABIT type defensive guard in `sanitizeActivityEntryTitle` (lib/operational-feed/queries.ts)

Added import of `deriveSafeHabitActivityText` and a `case EntryType.HABIT` branch. This guard ensures that if/when HABIT-type EntryActivity rows are created in a future arc, body content will never appear in feed activity titles.

### 3. New guardian-safe summary helpers (lib/journals/guardian-visibility.ts)

New pure-function module with no DB dependencies:

- **`isJournalVisibleToGuardian(journal, linkedAthleteIds)`** — Returns `true` only when the journal belongs to a linked athlete, has `ORGANIZATION_SCOPED` visibility, and is not a draft. Blocks `STAFF_ONLY` records explicitly.
- **`toGuardianSafeJournalSummary(journal)`** — Maps to `GuardianSafeJournalSummary`: omits `content` entirely, includes only safe fields (`id`, `title`, `status`, `createdAt`, `updatedAt`).
- **`toGuardianSafeHabitSummary(habit)`** — Maps to `GuardianHabitSummary`: omits `note` fields, derives count and streak from completion data.
- **`deriveGuardianAthleteJournalHabitSummary(athleteId, journals, habits, linkedAthleteIds)`** — Aggregates guardian-safe summary for a single athlete. Caps recent journals at 10, skips non-visible records silently, returns `null` for unlinked athletes.

### 4. New guardian-safe athlete summary page (app/(dashboard)/guardian-summary/page.tsx)

New route at `/guardian-summary` showing journal counts and habit summaries for linked athletes only.

**Authorization:**
1. Requires `PARENT_GUARDIAN` role assignment (checked via `db.roleAssignment.findFirst`).
2. Queries `AthleteGuardianRelationship` for linked athlete IDs.
3. If no linked athletes → shows empty state, no error leak.

**Data safety:**
- Journals query: `visibility = ORGANIZATION_SCOPED`, `status IN [DONE, ARCHIVED]`, **no `content` field in select**.
- Habits query: `completions` select includes only `completedOn` (no `note` field).
- `deriveGuardianAthleteJournalHabitSummary` re-applies visibility check before including any record.

### 5. Tests

**Extended `tests/operational-feed/activity-sanitization.test.ts`:**
- Prompt-specific action labels produce correct safe text
- HABIT type entries use `deriveSafeHabitActivityText` and never expose raw content

**New `tests/journals/guardian-visibility.test.ts` (19 tests):**
- `isJournalVisibleToGuardian`: draft blocked, STAFF_ONLY blocked, unlinked athlete blocked, empty set
- `toGuardianSafeJournalSummary`: no `content` field, archived label, required fields present
- `toGuardianSafeHabitSummary`: no `notes` field, count/streak correct
- `deriveGuardianAthleteJournalHabitSummary`: aggregation, filtering, cap at 10, sorted descending, unlinked returns `null`

---

## Files Changed

| File | Change |
|------|--------|
| `lib/journals/policy.ts` | Extended `deriveSafeJournalActivityText` with prompt action labels |
| `lib/operational-feed/queries.ts` | Added HABIT type guard in `sanitizeActivityEntryTitle` |
| `lib/journals/guardian-visibility.ts` | **New** — guardian-safe summary helpers |
| `app/(dashboard)/guardian-summary/page.tsx` | **New** — guardian-safe athlete summary page |
| `tests/operational-feed/activity-sanitization.test.ts` | Extended with HABIT and prompt-action tests |
| `tests/journals/guardian-visibility.test.ts` | **New** — 19 guardian visibility unit tests |
| `planning/ARC_23E_GUARDIAN_SAFE_VISIBILITY_AND_FEED_INTEGRATION.md` | **New** — this document |
| `planning/ARC_23E_VISIBILITY_AND_FEED_QA_CHECKLIST.md` | **New** — manual QA checklist |
| `planning/README.md` | Arc 23E marked complete, doc links added |

---

## Already-Correct (Verified, No Changes Needed)

The following access controls were already implemented in Arc 23B–23D and are still correct:

- `canReadJournalEntry` in `lib/journals/access.ts` — enforces visibility + guardian relationship scope. Verified: unlinked guardian receives `false`.
- `canReadHabit` / `canReadCompletionDetail` in `lib/habits/access.ts` — habit scope and note-field gating. Verified correct.
- `canReadAssignment` in `lib/journals/prompt-access.ts` — guardian relationship scope for prompt assignments. Verified correct.
- `queryAssignedEntries` / `queryInboxEntries` in `lib/operational-feed/queries.ts` — already exclude `EntryType.JOURNAL` from broad inbox/assigned feeds. Verified correct.
- `queryRecentActivity` — already calls `sanitizeActivityEntryTitle` for all activity rows. Verified correct.

---

## What Was Not Introduced

Per the problem statement constraints, the following are explicitly out of scope for Arc 23E:

- No Communications delivery (email/SMS/push)
- No AI recommendations or AI summaries
- No advanced analytics
- No readiness scoring
- No consent workflows
- No granular per-entry sharing controls
- No guardian self-service preferences
- No broad destructive schema changes

---

## Deferred to Future Arcs

| Item | Target Arc |
|------|-----------|
| Journal version history and trust/audit model | Arc 23F |
| Notification center (unread/read state) | Post-23F |
| Email/SMS/push reminders | Post-23F |
| Consent workflows for guardian access | Post-23F |
| Granular per-entry sharing controls | Post-23F |
| Guardian self-service access preferences | Post-23F |
| Coach structured review workflows | Post-23F |
| Readiness scoring and AI summaries | Future |
| Analytics and export | Future |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Journal body content remains protected by default | ✅ `content` field never in feed, guardian summary, or activity metadata |
| Feed and dashboard surfaces show safe summaries only | ✅ `sanitizeActivityEntryTitle` guards both JOURNAL and HABIT types |
| Guardian access is relationship-scoped | ✅ `isJournalVisibleToGuardian` + `deriveGuardianAthleteJournalHabitSummary` + page auth |
| Guardian cannot see unrelated athlete data | ✅ Unlinked athlete returns `null` / empty — 19 tests verify |
| Coach access scoped to team/program/athlete | ✅ Existing `canReadJournalEntry` + `canReadHabit` — verified unchanged |
| Habit summaries respect role-aware visibility | ✅ `toGuardianSafeHabitSummary` omits `note`; completion detail gated |
| Activity metadata does not leak private journal content | ✅ Prompt action labels added; no content in any label |
| Direct URL access enforces authorization | ✅ Journal/habit detail routes call `canReadJournalEntry`/`canReadHabit` |
| Existing Entry/Journal/Habit/MemberOps/feeds not broken | ✅ 718 tests passing |
| No Communications delivery introduced | ✅ |
| No broad destructive migration introduced | ✅ Additive-only changes |

---

## Next Arc

**Arc 23F — Journal Version History and Trust/Audit Model**

Recommended scope:
- Append-only version history for journal entries (schema: `JournalVersion` table)
- Trust indicators: submitted-at timestamp, version count, author identity
- Audit log for guardian/coach access events
- Version diff view (staff/admin only)
- Version restore (draft-only)
- Foundation for future compliance and consent audit trail
