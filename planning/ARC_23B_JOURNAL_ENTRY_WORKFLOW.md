# Arc 23B — Journal Entry Type and Draft/Final Workflow

## Scope

Arc 23B starts Journal runtime support on top of the existing `Entry` model.

In-scope:
- Journal draft creation
- Draft editing
- Finalize/submit flow
- Archive flow
- Role-aware journal visibility checks
- Safe feed/activity behavior (no journal body leakage)

Out-of-scope (deferred):
- Prompt library
- Prompt assignment
- Habits
- Recurring check-ins
- Journal version history
- Consent workflows
- AI prompt recommendations
- Mood/sentiment analysis
- External notifications
- Offline journaling
- Rich media journal entries

## Arc 23B Journal Data Model (current runtime)

Arc 23B uses additive runtime behavior on existing `Entry` records:

- `Entry.type = JOURNAL`
- `Entry.content` stores journal body text (sensitive)
- `Entry.createdByPersonId` is the journal author/owner
- `Entry.status` maps to journal workflow:
  - `OPEN` => `Draft`
  - `DONE` => `Submitted`
  - `ARCHIVED` => `Archived`
- `Entry.visibility` controls submitted visibility policy:
  - `STAFF_ONLY` => Athlete private default
  - `TEAM_STAFF` => Coach-scoped submitted visibility
  - `ORGANIZATION_SCOPED` => Guardian-scoped submitted visibility (relationship-gated)

## Workflow Rules

### Draft
- Author creates draft journal.
- Draft remains editable by author only.
- Draft body is not visible to guardian/coach.

### Submitted
- Author finalizes draft (`OPEN` -> `DONE`).
- Submitted visibility follows policy + role/relationship scope.
- Feed/activity may expose safe metadata labels only.

### Archived
- Author or org admin/program director can archive (`ARCHIVED`).
- Archived journals are removed from default active journal views.

## Role-Aware Access Policy

### Author
- Can view own journal (draft/submitted/archived)
- Can edit draft
- Can submit own draft
- Can archive own journal

### Org admin/program director
- Full read access across journal statuses
- Can archive journals

### Coach/assistant coach
- Submitted-only read
- Must be team/program scoped
- Requires `TEAM_STAFF` visibility policy
- No draft body access

### Guardian
- Submitted-only read
- Requires `ORGANIZATION_SCOPED` visibility policy
- Requires valid `AthleteGuardianRelationship`
- No draft body access

### Unrelated users
- No journal content access
- No draft read access

## Feed & Activity Safety

Journal actions write safe activity actions:
- `journal.draft_created`
- `journal.draft_updated`
- `journal.submitted`
- `journal.archived`

Safety guard:
- Journal body text is never persisted to `EntryActivity.metadataJson`.
- Broad feed activity sanitizes journal titles to safe labels (`Journal submitted`, etc.).
- Generic entry views exclude journal listing/detail to reduce broad surface leakage.

## UI Surfaces

- `/journals` — journal list with status + visibility hints
- `/journals/create` — create draft
- `/journals/[entryId]` — role-aware journal detail
- `/journals/[entryId]/edit` — draft edit
- `/journals/[entryId]/submit` — finalize/submit
- `/journals/[entryId]/archive` — archive

## Next Arc Recommendation

Recommended next scope:

**Arc 23C — Prompt Library and Prompt Assignment**
