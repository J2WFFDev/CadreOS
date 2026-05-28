# Arc 23C — Prompt Library and Prompt Assignment

**Status:** Implementation complete  
**Depends on:** Arc 23A (Journals & Habits Inventory, Privacy Model), Arc 23B (Journal Entry Type and Draft/Final Workflow)  
**Next:** Arc 23D — Habit Model, Recurrence, and Completion Tracking

---

## Overview

Arc 23C introduces a reusable Prompt Library that staff and coaches can use to create journal prompts and assign them to athletes, members, or teams. Athletes respond by creating a journal entry from the assigned prompt. Assignment completion is tracked without exposing private journal body text.

This arc is additive: no existing Entry, Journal, MemberOps, GearOps, or feed behavior is broken.

---

## Domain Model

### JournalPrompt

A reusable prompt template created and managed by org admins or program directors.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `organizationId` | `String` | Org scope |
| `title` | `String` | Short label for the prompt |
| `promptText` | `String` | The actual prompt body shown to athletes |
| `category` | `String?` | Optional category (e.g. "Reflection", "Goal Setting") |
| `tags` | `String[]` | Optional tag list |
| `active` | `Boolean` | Active/archived flag; default `true` |
| `archivedAt` | `DateTime?` | Set when archived |
| `createdByPersonId` | `String?` | Author |
| `createdAt` / `updatedAt` | `DateTime` | Timestamps |

**Privacy:** Prompt text is visible to staff and assigned athletes. Archived prompts are excluded from the assignable list unless intentionally shown.

### JournalAssignment

A specific assignment of a prompt to one or more athletes or a team.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `organizationId` | `String` | Org scope |
| `journalPromptId` | `String` | FK → JournalPrompt |
| `assignedByPersonId` | `String?` | Staff/coach who assigned |
| `assignedToAthletePersonId` | `String?` | Individual athlete (nullable if team assignment) |
| `assignedToTeamId` | `String?` | Team assignment (nullable if individual) |
| `status` | `JournalAssignmentStatus` | PENDING / ACTIVE / COMPLETED / CANCELLED / EXPIRED |
| `scheduledFor` | `DateTime?` | Future activation date (status = PENDING until then) |
| `dueAt` | `DateTime?` | Optional due date |
| `notes` | `String?` | Optional staff notes (internal) |
| `createdAt` / `updatedAt` | `DateTime` | Timestamps |

### PromptResponse (via Entry)

When an athlete creates a journal response to an assigned prompt, a standard `Entry` record is created with:
- `type = JOURNAL`
- `journalPromptId` — FK to the source prompt
- `journalAssignmentId` — FK to the specific assignment

This preserves Arc 23B's Entry-based journal model and all existing privacy rules.

### JournalAssignmentStatus Enum

```
PENDING    — Scheduled for future activation (scheduledFor is future)
ACTIVE     — Currently open for athlete response
COMPLETED  — Athlete has submitted a journal response
CANCELLED  — Cancelled by assigning staff or admin
EXPIRED    — Past due without response (future automated job)
```

---

## Workflow

### Staff/Coach flow

1. Navigate to `/prompts` — Prompt Library list
2. Create a prompt: `/prompts/create` → fill title, promptText, optional category/tags
3. View prompt detail: `/prompts/[promptId]`
4. Edit prompt: `/prompts/[promptId]/edit`
5. Archive prompt: POST `/prompts/[promptId]/archive` (sets `active=false`)
6. Assign prompt: `/prompts/[promptId]/assign` → pick athlete or team, optional due date, optional scheduledFor
7. View assignment list per prompt on the detail page

### Athlete flow

1. Navigate to `/prompt-assignments` — My Assignments list
2. See assignments with status, due dates, overdue/due-soon color indicators
3. Click "Respond" → `/journals/create?promptId=X&assignmentId=Y`
4. Journal create page shows the prompt text above the editor; title pre-filled with prompt title
5. Save draft → Entry is created with `journalPromptId` and `journalAssignmentId` set
6. Submit journal → assignment status set to COMPLETED

### Assignment status progression

```
assign() → ACTIVE  (or PENDING if scheduledFor is future)
athlete submits journal response → COMPLETED
staff cancels assignment → CANCELLED
```

---

## Authorization Matrix

| Action | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | ATHLETE | PARENT_GUARDIAN |
|---|---|---|---|---|---|---|
| Create prompt | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit prompt | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archive prompt | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read prompt library | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Assign prompt | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cancel assignment | ✅ | ✅ | Own only | Own only | ❌ | ❌ |
| View own assignments | ✅ | ✅ | ✅ | ✅ | Own | Linked athlete only |
| Respond to assignment | ❌ | ❌ | ❌ | ❌ | Own | ❌ |

**Guardian visibility:** Guardians can view assignment status and completion for athletes they are linked to (via `AthleteGuardianRelationship`). Guardians cannot see unrelated athletes' assignments. Guardians cannot see journal body text.

---

## Privacy and Feed Safety

All prompt activity uses the `EntryActivity` table anchored to the Journal Entry. Activity metadata never includes:
- Journal body text
- Journal title
- Prompt response content

Safe activity payloads include only:
- `{ visibility, hasPrompt: true }` for journal submission activity
- Assignment ID and prompt ID references (no content)

Prompt assignment events (`journal.prompt_assigned`) cannot be anchored to an `EntryActivity` row because no Entry exists yet. These are tracked at the `JournalAssignment` model level. Arc 23E may introduce a feed-level assignment event model.

---

## Files Changed

### Schema
- `prisma/schema.prisma`: Added `JournalAssignmentStatus` enum, `JournalPrompt` model, `JournalAssignment` model; nullable FK fields `journalPromptId` / `journalAssignmentId` on `Entry`; back-relations on `Organization`, `Person`, `Team`

### Authorization
- `lib/journals/prompt-access.ts` *(new)*: `canManagePromptLibrary`, `canReadPromptLibrary`, `canAssignPrompt`, `canReadAssignment`, `canCancelAssignment`, `canRespondToAssignment`, `labelForAssignmentStatus`, `isAssignmentOpen`, `computeAssignmentDueState`, `deriveSafePromptActivityText`

### Activity & Feed
- `lib/operational-entry/types.ts`: Added `JOURNAL_PROMPT_ASSIGNED`, `JOURNAL_PROMPT_RESPONSE_SUBMITTED`, `JOURNAL_PROMPT_ASSIGNMENT_CANCELLED`
- `lib/operational-feed/render.ts`: Added feed labels for the three new prompt activity actions

### Prompt Library UI
- `app/(dashboard)/prompts/page.tsx` *(new)*: Prompt library list — active/archived/all filter, assignment counts
- `app/(dashboard)/prompts/create/page.tsx` *(new)*: Create prompt form
- `app/(dashboard)/prompts/create/save/route.ts` *(new)*: POST — create JournalPrompt
- `app/(dashboard)/prompts/[promptId]/page.tsx` *(new)*: Prompt detail — metadata, assignment list (no journal body)
- `app/(dashboard)/prompts/[promptId]/edit/page.tsx` *(new)*: Edit prompt form
- `app/(dashboard)/prompts/[promptId]/edit/update/route.ts` *(new)*: POST — update JournalPrompt
- `app/(dashboard)/prompts/[promptId]/archive/route.ts` *(new)*: POST — archive prompt
- `app/(dashboard)/prompts/[promptId]/assign/page.tsx` *(new)*: Assign prompt form
- `app/(dashboard)/prompts/[promptId]/assign/save/route.ts` *(new)*: POST — create JournalAssignment

### Assignment UI
- `app/(dashboard)/prompt-assignments/page.tsx` *(new)*: Athlete/staff assignment list — open/completed/all filter, status indicators, "Respond" link

### Journal Integration
- `app/(dashboard)/journals/create/page.tsx`: Extended to display prompt context from `?promptId=X&assignmentId=Y` query params
- `app/(dashboard)/journals/create/save/route.ts`: Persists `journalPromptId` and `journalAssignmentId` on Entry; validates assignment is open and belongs to org
- `app/(dashboard)/journals/[entryId]/submit/route.ts`: Marks linked `JournalAssignment` as COMPLETED on submission
- `app/(dashboard)/journals/[entryId]/page.tsx`: Shows prompt context box when entry is a prompt response; adds "Source: Prompted/Freeform" metadata field

### Tests
- `tests/journals/prompt-access.test.ts` *(new)*: Unit tests for all `prompt-access.ts` helpers — 30+ cases covering role boundaries, guardian isolation, status transitions, due state logic

---

## Deferred Scope (Arc 23D+)

The following items are explicitly NOT included in Arc 23C:

- **Habits** — Habit model, recurrence, completion tracking → Arc 23D
- **Recurring prompt schedules** — automated re-assignment of prompts on a schedule → future arc
- **AI prompt recommendations** — no ML/LLM integration in this arc
- **Prompt scoring / rubrics** — no structured rubric fields
- **Mood / sentiment analysis** — no response analysis
- **Consent workflows** — guardian consent for journals, minor data consent
- **External notifications** — no email/SMS/push in this arc
- **Bulk prompt assignment polish** — single-assignment flow only; bulk import is deferred
- **Advanced analytics / export** — prompt completion rate dashboards
- **EntryActivity for assignment events** — `journal.prompt_assigned` activity cannot be anchored to an Entry row until a feed-level assignment event model exists (Arc 23E)
- **Automated status expiry** — EXPIRED status must be set by a scheduled job; no automated expiry in this arc
- **Prompt version history** — no version tracking for prompt text edits

---

## Database Migration

Arc 23C adds new tables (`JournalPrompt`, `JournalAssignment`) and new nullable FK columns (`Entry.journalPromptId`, `Entry.journalAssignmentId`). All existing rows remain valid. Migration command:

```
npx prisma migrate deploy
```

No existing data is modified or dropped.
