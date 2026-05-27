# Arc 21A Athlete Journaling Capability Roadmap (Planning)

## 1) Purpose

Capture athlete journaling as a first-class CadreOS capability in the Entry ecosystem, with privacy-aware visibility, task-based prompt assignment, feed integration, and auditable version history.

This document is planning-only and does not introduce runtime changes in this arc.

## 2) Scope and Product Intent

Athlete journaling is an Athlete Development feature that sits across:
- Entries
- Tasks
- Feed
- Guardian visibility
- Authorization/privacy policy

The capability must support:
- Freeform reflection
- Prompt-driven reflection
- Assigned and scheduled prompts
- Journal lifecycle (draft/final/archive)
- Visibility controls by relationship and role
- Edit/version trust and traceability

## 3) Journal as a First-Class Entry Type

Add `JOURNAL` as a formal `EntryType` in the unified Entry direction.

Rules:
- Journal entries are athlete-authored by default.
- Journal entries appear in athlete personal feed views.
- Journal entries appear in guardian feed views when relationship and policy allow.
- Journal entries are not treated as generic staff notes.

## 4) Journal Creation Sources

Add `JournalSource` to represent creation mode:
- `FREEFORM`
- `PROMPT_ASSIGNED`
- `PROMPT_SCHEDULED`
- `PROMPT_SELF_SELECTED`

## 5) Prompt Library Model

Define `JournalPrompt` with:
- `id`
- `title`
- `promptText`
- `category`
- `audienceLevel`
- `tags[]` (optional)
- `active`
- `createdBy`
- `createdAt`
- `updatedAt`

Example categories include:
- Pre-practice reflection
- Post-practice reflection
- Match preparation
- Match review
- Goal setting
- Confidence check
- Equipment readiness
- Teamwork/sportsmanship
- Recovery from mistakes

## 6) Assignment and Scheduling via Tasks

Use existing task architecture instead of parallel assignment systems.

Define `JournalAssignment` with:
- `id`
- `promptId`
- `assignedToAthleteId` (nullable)
- `assignedToGroupId` (nullable)
- `assignedBy`
- `scheduledFor` (nullable)
- `dueAt` (nullable)
- `taskId` (nullable linkage to FollowUpTask/Entry task)
- `status`
- `createdAt`
- `updatedAt`

Operational behavior:
- Staff can assign to one athlete or a group/team.
- Staff can schedule for future activation.
- Due windows and completion state are trackable.
- Task status and journal completion remain linked.

## 7) Journal Lifecycle and Versioning

Define `JournalStatus`:
- `DRAFT`
- `FINAL`
- `ARCHIVED`

Lifecycle rules:
- Draft is editable by athlete.
- Final represents submitted reflection.
- Archived is retained but hidden from active/default views.
- Status transitions are timestamped.

Track edit metadata in `JournalEntry`:
- `createdAt`, `createdBy`
- `updatedAt`, `updatedBy`
- `version`
- `finalizedAt` (nullable)
- `archivedAt` (nullable)

Track historical integrity in `JournalVersion`:
- `id`
- `journalEntryId`
- `versionNumber`
- `contentSnapshot`
- `status`
- `editedBy`
- `editedAt`
- `changeReason` (nullable)

Design rule: never overwrite journal content without preserving sufficient prior state for audit/trust.

## 8) Privacy, Guardian, and Staff Visibility Notes

### Guardian access
- Guardians can view journal entries connected to assigned athlete(s) when policy permits.
- Guardians can view assigned prompts and completed responses when policy permits.
- Access is relationship-gated (`AthleteGuardianRelationship`) and organization-scoped.

### Coach/staff access
Do not default to broad coach visibility.

Prepare `visibilityPolicy` to support:
- Athlete + guardian only
- Assigned coach visible
- Team staff visible
- Admin visible
- Shared-by-athlete

### Safety constraints
- Feed and list summaries must avoid content leakage to unauthorized users.
- Policy evaluation must happen before showing body content, not only before mutation.
- Staff-only or restricted reflections remain hidden from guardians/other staff unless allowed by policy.

## 9) Feed Integration Expectations

Journal events should emit role-safe feed activity:
- Journal draft created
- Journal finalized/submitted
- Prompt assignment created
- Prompt due soon
- Journal completion recorded

Feed payloads should be scoped:
- Unauthorized viewers see no item.
- Authorized-but-limited viewers see safe summary metadata.
- Full content appears only to authorized policy viewers.

## 10) Technical Notes: Data Model Impact

Planned model additions/updates:
- Extend `EntryType` with `JOURNAL`.
- Add `JournalSource` and `JournalStatus` enums.
- Add `JournalEntry` specialized record linked to base `Entry`.
- Add `JournalPrompt` for reusable prompt library.
- Add `JournalAssignment` linked to task architecture.
- Add `JournalVersion` for immutable content snapshots.

Planned interoperability:
- Reuse actor attribution and organization scoping patterns.
- Reuse relationship-aware guardian filtering patterns.
- Reuse existing task due/status semantics where possible.
- Reuse feed visibility evaluation patterns and authorization helpers.

## 11) Implementation Backlog (Planning)

### Track 1: Foundation
- Add `JOURNAL` entry type contract and planning acceptance criteria.
- Define freeform journal create/edit/finalize/archive behavior.
- Add baseline guardian visibility rules for journal entries.
- Add created/updated/finalized/archived timestamps and actor metadata.

### Track 2: Prompts + task integration
- Implement prompt library CRUD and active/inactive management.
- Support athlete self-selected prompt flow.
- Support assigned and scheduled prompts integrated with tasks.
- Add completion tracking for prompt-based journaling.

### Track 3: trust + advanced visibility
- Implement version history and snapshot retrieval.
- Add configurable visibility policy evaluation path.
- Add feed filtering and role-safe feed item rendering.
- Add completion and status summary reporting views.

### Track 4: growth workflows
- Add reflection templates.
- Add optional coach review workflows with policy controls.
- Add athlete growth trend surfaces.
- Add privacy/admin policy control surfaces.

## 12) Delivery Notes

This roadmap update is documentation-only and should be executed in implementation tracks aligned with active Entry/Task/Feed arcs.
